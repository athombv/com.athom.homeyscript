(function () {
  "use strict";
  let navigationState = false;
  let $navigationMenu;
  let $navigationButton;
  let $body;

  documentReady(function () {
    $body = document.querySelector(`body`);
    $navigationMenu = document.querySelector(`[data-docs-nav-menu]`);

    /**
     * Toggle mobile menu
     */
    $navigationButton = document.querySelector(`[data-docs-nav-toggle]`);
    $navigationButton.addEventListener('click', buttonOnClickHandler, false);
  });

  /**
   * Navigation OnClick Handler
   * @description Toggles the mobile menu
   */
  function navigationOnClickHandler() {
    navigationState = !navigationState;

    if (navigationState) {
      $body.classList.add('is-docs-nav-active');

      $navigationMenu.addEventListener("click", function (event) {
        event.stopPropagation();
      }, false);
      $body.addEventListener("click", navigationOnClickHandler);
    } else {
      $body.classList.remove('is-docs-nav-active');
      $body.removeEventListener("click", navigationOnClickHandler);
      // todo removeEventListener should be added for $navigationMenu somehow
    }
  }

  function buttonOnClickHandler(event) {
    event.stopPropagation();
    navigationOnClickHandler();
  }
})();
