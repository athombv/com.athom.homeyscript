'use strict';

module.exports = {
  async getSomething({ homey, query }) {
    // you can access query parameters like "/?foo=bar" through `query.foo`

    // you can access the App instance through homey.app
    // const result = await homey.app.getSomething();
    // return result;

    // perform other logic like mapping result data

    return `
    <html>
  <head>
    <style>
      /* Example of a custom CSS class. */
      .custom-image-class {
        margin: var(--homey-su-3) auto var(--homey-su-5);
      }
    </style>
  </head>

  <body class="homey-widget">
    <img src="homey-logo.png" alt="Homey logo" class="custom-image-class" />
    <p class="homey-text-regular homey-text-align-center">Edit public/index.html and hit refresh.</p>

    <script type="text/javascript">
      function onHomeyReady(Homey) {
        Homey.ready({ height: 188 });

        // View the settings the user provided if your widget has settings.
        console.log('Widget settings:', Homey.getSettings());

        // Fetch something from your app.
        Homey.api('GET', '/', {})
          .then((result) => {
            console.log(result);
          })
          .catch(console.error);
      }
    </script>
  </body>
</html>
    `;
  },

  async addSomething({ homey, body }) {
    // access the post body and perform some action on it.
    return homey.app.addSomething(body);
  },

  async updateSomething({ homey, params, body }) {
    return homey.app.setSomething(body);
  },

  async deleteSomething({ homey, params }) {
    return homey.app.deleteSomething(params.id);
  },
};
