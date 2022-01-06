export const hideAlert = () => {
  const element = document.querySelector('.alert');
  if (element) element.parentElement.removeChild(element);
};
// type => success || error
export const showAlert = (type, message) => {
  // hide existing alert
  hideAlert();
  const markup = `<div class="alert alert--${type}">${message}</div>`;
  document.querySelector('body').insertAdjacentHTML('afterbegin', markup);

  // Close Alert
  window.setTimeout(hideAlert, 5000);
};
