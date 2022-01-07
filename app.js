const path = require('path');
const express = require('express');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const helmet = require('helmet');
const mongoSanitize = require('express-mongo-sanitize');
const xss = require('xss-clean');
const hpp = require('hpp');
const cookieParser = require('cookie-parser');
const csp = require('express-csp');
const compression = require('compression');
// Understanding CORS => Cross Origin Resource Sharing
// https://natours-leumas.herokuapp.com/  example.com/
// two website with different req.host trying to access or query from another => CORS not allowed
// to make API Available to everyone => this would fail as of right with the current CORS implementation
// CORS sharing by default blocked => and this behavior is for browsers mainly
const cors = require('cors');

const AppError = require('./utils/appError');
const globalErrorHandler = require('./controllers/errorController');
// this allows for separation of concerns => SOC => different modules handle each component of the app
const tourRouter = require('./routes/tourRoutes');
const userRouter = require('./routes/userRoutes');
const reviewRouter = require('./routes/reviewRoutes');
const viewRouter = require('./routes/viewRoutes');
const bookingRouter = require('./routes/bookingRoutes');
const { webhookCheckout } = require('./controllers/bookingController');

const app = express();

// heroku is a proxy => like a middle man that redirects and modifies routes => therefore make sure heroku is trusted
app.enable('trust proxy');

// To render view from server side => use pug engine => pug is the most commonly used
// express => supports most view engines out of the box
// view engine => rep the VIEW section of MVC Architecture
app.set('view engine', 'pug');
app.set('views', path.join(__dirname, 'views'));

// CORS IMPLEMENTATION
// you can strict cors to specific routes only => there only exposing a certain set of resources to the world
// Currently works for simple | SAFE requests only => this only allows GET and POST => (OPTIONS, GET, HEAD)
app.use(cors());
// Access-Control-Allow-Origin *
// allow cross with domains with the same name
// backend link api.natours.com frontend link => natours.com => it strictly only allows communication between these two
// app.use(
//   cors({
//     origin: 'https://www.natours.com',
//   })
// );
//
// ALLOWING NON-SIMPLE | UNSAFE  requests in this case => the browser sends an option to check if the operation is safe to send THEN it sends the UNSAFE Request => (DELETE, PUT, PATCH, POST)
// Allow options + cors() => preflight request + flight request =>
app.options('*', cors());
// can also restrict options to specific routes => or domains of the web application

// serve STATIC FILES
// serving static files using middle wares => public is not need at the url because it serves as the active root therefore => you ony really need to add the file name you are quering for
// works together with our views engine
// this servers all assets from public
app.use(express.static(path.join(__dirname, 'public')));

// 1) GLOBAL MIDDLEWARES

// set SECURITY HTTP Headers
// Error => encountered with using Mapbox CDN  => CSP Directive Error => Content Security Policy
// use default helmet config throws errors => unless the security of the application is improved in this case => CSP for helmet

// FIX: CSP Directive Error

app.use(helmet());

csp.extend(app, {
  policy: {
    directives: {
      'default-src': ['self'],
      'style-src': ['self', 'unsafe-inline', 'https:'],
      'font-src': ['self', 'https://fonts.gstatic.com'],
      'script-src': [
        'self',
        'unsafe-inline',
        'data',
        'blob',
        'https://js.stripe.com',
        'https://*.mapbox.com',
        'https://*.cloudflare.com/',
        'https://bundle.js:8828',
        'ws://localhost:56558/',
      ],
      'worker-src': [
        'self',
        'unsafe-inline',
        'data:',
        'blob:',
        'https://*.stripe.com',
        'https://*.mapbox.com',
        'https://*.cloudflare.com/',
        'https://bundle.js:*',
        'ws://localhost:*/',
      ],
      'frame-src': [
        'self',
        'unsafe-inline',
        'data:',
        'blob:',
        'https://*.stripe.com',
        'https://*.mapbox.com',
        'https://*.cloudflare.com/',
        'https://bundle.js:*',
        'ws://localhost:*/',
      ],
      'img-src': [
        'self',
        'unsafe-inline',
        'data:',
        'blob:',
        'https://*.stripe.com',
        'https://*.mapbox.com',
        'https://*.cloudflare.com/',
        'https://bundle.js:*',
        'ws://localhost:*/',
      ],
      'connect-src': [
        'self',
        'unsafe-inline',
        'data:',
        'blob:',
        'wss://*.herokuapp.com:*/',
        'https://*.stripe.com',
        'https://*.mapbox.com',
        'https://*.cloudflare.com/',
        'https://bundle.js:*',
        'ws://localhost:*/',
      ],
    },
  },
});

// allowing only logs only on development
if (process.env.NODE_ENV === 'development') {
  // use third-party middleware
  // morgan => is a request logger
  app.use(morgan('dev'));
}

// set REQUEST RATE LIMITER
// rateLimit is a hook from a third party package => express-rate-limit
//  to reduce the number of request that can be sent from an API
// security benefits => set a quota on request per hour therefore prevent several attempt that could cause a DOS => temporarily crash our web app
const limiter = rateLimit({
  max: 100,
  // 100 requests/hour
  windowMs: 60 * 60 * 1000,
  message: 'Requests limit exceeded. Try again in an hour!',
});

// apply this limit to all API routes
// what this does => the package create two custom headers tracking the number of request sent
// X-RateLimit-Limit && X-RateLimit-Remaining
app.use('/api', limiter);

// adding Stripe Webhook checkout route
// the response sent from stript to acknowledge a successful checkout needs to be a stream
// a json received results in an error
// if this route follow below the json body parser it will defined convert the data to json format
// => how to parse data from stripe
app.post(
  '/webhook-checkout',
  express.raw({ type: 'application/json' }),
  webhookCheckout
);

// set BODY PARSER => reading data from body into req.body
// to get body from post request
// express.json() is the middleware it can modified the incoming data they are like filter queues
// limit the number of properties in a json body for post request
app.use(express.json({ limit: '10kb' }));
// to get the data sent from HTML FORMS => sent using urlEncoded
app.use(express.urlencoded({ extended: true, limit: '10kb' }));
// to parse cookies in requests => so the browsers can authenticate the page
app.use(cookieParser());

// NOTE: Data sanitization =>  is clean all incoming payload/body from malicious code

// e.g{email: {"$gt": " "}} => always results to true hence exposing all user info
// 1. Data Sanitization - NOSQL query injection
app.use(mongoSanitize());
// 2. Data Sanitization - XSS Attacks
// cleans all malicious html and code injected with javascript
// FIXME: not sure if this middleware works
app.use(xss());

// hpp => http parameter pollution middle ware => prevents parameter pollution
// e,g ?sort=price&sort=name
app.use(
  hpp({
    // whitelist properties or fields allowed
    whitelist: [
      'duration',
      'ratingsAverage',
      'ratingsQuantity',
      'maxGroupSize',
      'difficulty',
      'price',
    ],
  })
);

// middleware can manipulate the request => everything is middleware in express
// e.g response.json => middle stack has all middleware used and the order is user defined and matters
// compresses all text files
app.use(compression());
// creating middleware => app.use() is used to consume middleware
// always call next on middleware
// location of middleware matters a lot => if placed between a request there will be a logic misplacement

// set REQUEST TIME
app.use((req, res, next) => {
  req.requestTime = new Date().toISOString();
  // display user cookie each time
  // console.log(req.cookies);
  next();
});

// 2) General Routes
// Routes
//  the order of callback function parameters matters
//  Express format the application type in the header and some other information as well
// app.get('/', (req, res) => {
//   res
//     .status(200)
//     .json({ message: 'Hello from the server side!', app: 'Natours' });
// });

// app.post('/', (req, res) => {
//   res.send('You can post to this endpoint..');
// });

// Render routes for views
app.use('/', viewRouter);
// MOUNTING ROUTERS
app.use('/api/v1/tours', tourRouter);
app.use('/api/v1/users', userRouter);
app.use('/api/v1/reviews', reviewRouter);
app.use('/api/v1/bookings', bookingRouter);
// fallback router => for all invalid request
// this fallback for invalid route is only reach when other routes are not matched
// just like routing in react
app.all('*', (req, res, next) => {
  // pass the error into next => next with err value have highest priority and it skips other middleware to send the error message to the global error middleware handler

  next(new AppError(`Can't find ${req.originalUrl} on this server`, 404));
});

// express comes with error middleware handler out of the box => the idea is to have a central error handling middleware
app.use(globalErrorHandler);

module.exports = app;

// Types of Errors
// => operational errors are => predicted to happen and can be handled in advance => dependent on network, database, or user failures => these are the main focus for express easier to catch
// => invalid path, invalid user input, failure to connect to server or db

// programming errors => bugs by devs
