/**
 * try-catch not ideal for controller instead there should
 * be a wrapper method that catches the error
 * this is a wrapper function that takes a function which
 * has the req,res,next params and calls the function using those parameters
 * or a rewrite would be just like in redux-thunk in react
 * @param {*} func
 * @returns
 */
// eslint-disable-next-line arrow-body-style
const catchAsync = (func) => {
  return (req, res, next) => {
    func(req, res, next).catch(next);
  };
};

module.exports = catchAsync;
