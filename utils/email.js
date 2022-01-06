const nodemailer = require('nodemailer');
const pug = require('pug');
const htmlToText = require('html-to-text');

module.exports = class Email {
  constructor(user, url) {
    this.to = user.email;
    this.firstName = user.name.split(' ')[0];
    this.url = url;
    this.from = `Alade Junior <${process.env.EMAIL_FROM}>`;
  }

  newTransport() {
    if (process.env.NODE_ENV === 'production') {
      // Create transporter for send grid
      return nodemailer.createTransport({
        service: 'SendGrid',
        auth: {
          user: process.env.SENDGRID_USERNAME,
          pass: process.env.SENDGRID_PASSWORD,
        },
      });
    }

    // use node mailer on development
    return nodemailer.createTransport({
      // service: 'Gmail',
      host: process.env.EMAIL_HOST,
      port: process.env.EMAIL_PORT,
      auth: {
        user: process.env.EMAIL_USERNAME,
        pass: process.env.EMAIL_PASSWORD,
      },
      // Activate in Gmail "less secure app" option
    });
  }

  /**
   * Send the email
   * @param {*} template => pug file
   * @param {*} subject  => email message
   */
  async send(template, subject) {
    // 1. Render HTML Based templates
    // renderFile => transform pug template to html
    const html = pug.renderFile(`${__dirname}/../views/email/${template}.pug`, {
      firstName: this.firstName,
      url: this.url,
      subject,
    });

    // B. convert html to simple text
    const text = htmlToText.fromString(html);

    // 2. Define the options
    const emailOptions = {
      from: this.from,
      to: this.to,
      subject,
      html,
      // text better for delivery rate
      text,
      // html:
    };
    // 3. Create transport and send email
    await this.newTransport().sendMail(emailOptions);
  }

  async sendWelcome() {
    // Send another mail type
    await this.send('welcome', 'Welcome to the Natours Family!');
  }

  async sendPasswordReset() {
    await this.send(
      'passwordReset',
      'Your passed reset token (valid for only 10 minutes)'
    );
  }
};

/**
 *
 * @param {*} options: Object
 */
// const sendEmail = async (options) => {
//   // 1. Create a transporter
//   const transporter = nodemailer.createTransport({
//     // service: 'Gmail',
//     host: process.env.EMAIL_HOST,
//     port: process.env.EMAIL_PORT,
//     auth: {
//       user: process.env.EMAIL_USERNAME,
//       pass: process.env.EMAIL_PASSWORD,
//     },
//     // Activate in Gmail "less secure app" option
//   });
//   // 2. Define the email options
//   const emailOptions = {
//     from: 'Kawhi Leonard <iclamp@lakers.com>',
//     to: options.email,
//     subject: options.subject,
//     text: options.message,
//     // html:
//   };
//   // 3. Sending the email
//   await transporter.sendMail(emailOptions);
// };

// module.exports = sendEmail;
