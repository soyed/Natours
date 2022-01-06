const mongoose = require('mongoose');
const dotenv = require('dotenv');

// uncaught exception errors not handled anywhere in async code
// catches all errors
process.on('uncaughtException', (err) => {
  console.log(err);
  console.log('Uncaught Exception 🧨 Shutting Down....');

  process.exit(1);
});

// configure the environment variables again the order matter
dotenv.config({ path: './config.env' });
const app = require('./app');

const DB = process.env.DATABASE.replace(
  '<PASSWORD>',
  process.env.DATABASE_PASSWORD
);

// this options deal with deprecating warnings
mongoose
  .connect(DB, {
    useNewUrlParser: true,
    useCreateIndex: true,
    useFindAndModify: false,
    useUnifiedTopology: true,
  })
  .then(() => {
    console.log('DB Connection Successful!');
  });

// setting up environment variables => prod and dev environments
// create the server
// must specify for heroku => the port variable
const port = process.env.PORT || 3000;
const server = app.listen(port, () => {
  console.log(`App is running on ${port}..`);
});

// important for running mongodb locally
// mongod --dbpath /usr/local/var/mongodb

// unhandled rejection => in node js => a promise rejected not handled in the application
// globally => use event listener
// useful for safety always catch error to the corresponding method or function created
process.on('unhandledRejection', (err) => {
  console.log('Unhandled Exception 🧨 Shutting Down....');
  console.log(err.name, err.message);
  // Do not abruptly shutdown all execution instead
  // gives server time to close => should be restarted
  server.close(() => {
    // 0 - success and 1 - uncalled exception
    process.exit(1);
  });
});
