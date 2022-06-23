(function () {
  "use strict";
  let navigationState = false;
  let navigationSearchTerm = false;
  let $navigationButton;
  let $navigationSearch;
  let $navigationSearchReset;
  let $body;

  documentReady(function () {
    $body = document.querySelector(`body`);

    /**
     * Toggle mobile menu
     */
    $navigationButton = document.querySelector(`[data-navigation-toggle]`);
    $navigationButton.addEventListener('click', navigationOnClickHandler);

    /**
     * Navigation Search
     */
    $navigationSearch = document.querySelector(`[data-navigation-search]`);
    $navigationSearchReset = document.querySelector(`[data-navigation-search-reset]`);

    $navigationSearch.addEventListener('keyup', searchOnKeyUpHandler);
    $navigationSearchReset.addEventListener('click', searchResetOnClickHandler);

    // reactivate filter after opening new page
    navigationSearchTerm = sessionStorage.getItem('navigationSearch');
    if (navigationSearchTerm) {
      $navigationSearch.value = navigationSearchTerm;
      filterKeyword();
    }

    // remove local storage for navigation search
    sessionStorage.removeItem('navigationSearch');

    /**
     * Active menu item
     */
    const url = window.location.toString();
    let page = url.substring(url.lastIndexOf('/') + 1).split('#')[0];
    if (page.indexOf('.html') === -1) {
      page += '.html';
    }

    const $activeMenuItemLink = document.querySelector(`[data-navigation] [href="${page}"]`);

    if ($activeMenuItemLink) {
      const $activeMenuItem = $activeMenuItemLink.parentElement;
      $activeMenuItem.classList.add('is-active');
      $activeMenuItem.classList.add('is-active-current');
      $activeMenuItem.classList.add('is-open');


      // Open navigation tree
      showChildItemOfActiveItem($activeMenuItem, parseInt($activeMenuItem.dataset.lvl) + 1);
      showParentItemOfActiveItem($activeMenuItem, parseInt($activeMenuItem.dataset.lvl) - 1);
    }

    /**
     * Collapsable menu items
     */
    const $menuItems = document.querySelectorAll(`[data-navigation] [data-lvl]`);
    $menuItems.forEach(($menuItem) => {
      if (!$menuItem.nextSibling) {
        return;
      }

      if ($menuItem.dataset.lvl < $menuItem.nextSibling.dataset.lvl) {
        $menuItem.classList.add('is-collapsable');
        var collapseButton = document.createElement("button");
        collapseButton.classList.add('nav-group__item-collapse');
        $menuItem.appendChild(collapseButton);
        collapseButton.addEventListener('click', function(){
          toggleTree($menuItem, parseInt($menuItem.dataset.lvl) + 1);
        });
      }
    });

    /**
     *  Save menu scroll position
     */
    const $navigationScroll = document.querySelector(`[data-navigation-scroll]`);
    $navigationScroll.scrollTop = sessionStorage.getItem('navigationScroll');

    // reset sessionStorage for scroll position
    sessionStorage.removeItem('navigationScroll');

    /**
     * Save data over multiple pages
     */
    window.onbeforeunload = function () {
      // Save scroll position in navigation
      let position = $navigationScroll.scrollTop;
      sessionStorage.setItem('navigationScroll', position);
      // Save current search term for navigation
      if (navigationSearchTerm) {
        sessionStorage.setItem('navigationSearch', navigationSearchTerm);
      }
    }
  });

  /**
   * Navigation OnClick Handler
   * @description Toggles the mobile menu
   */
  function navigationOnClickHandler() {
    navigationState = !navigationState;

    if (navigationState) {
      $body.classList.add('is-navigation-active');
    } else {
      $body.classList.remove('is-navigation-active');
    }
  }

  /**
   * Search onKeyUp Handler
   * @description gets triggered when someone is using the filter in the navigation
   * @param event
   */
  function searchOnKeyUpHandler(event) {
    navigationSearchTerm = event.target.value;
    filterKeyword();
  }

  /**
   * Search Reset OnClick Handler
   * @description resets navigation filter input value
   */
  function searchResetOnClickHandler() {
    navigationSearchTerm = false;
    $navigationSearch.value = '';
    filterKeyword();
  }

  /**
   * Filter Keyword for navigation
   */
  function filterKeyword() {
    // reset matches
    const allMenuItems = document.querySelectorAll(`[data-search-key]`);
    allMenuItems.forEach((item) => {
      item.classList.remove('is-match');
      item.classList.remove('is-match-parent');
    });

    // if no value stop
    if (!navigationSearchTerm) {
      $body.classList.remove('is-navigation-search');
      sessionStorage.removeItem('navigationSearch');
      return;
    }

    // show match
    $body.classList.add('is-navigation-search');

    // support multiple keywords
    const terms = navigationSearchTerm.toLowerCase().trim().split(' ')
    // build search query
    let query = '';
    terms.forEach(function (term) {
      query += `[data-search-key*="${term}"]`;
    })

    const matches = document.querySelectorAll(query);
    matches.forEach((match) => {
      const lvl = parseInt(match.dataset.lvl) - 1;
      showParentItem(match, lvl);
      match.classList.add('is-match');
    });
  }

  /**
   * @description Show parent item while searching in navigation
   * @param target
   * @param lvl
   */
  function showParentItem(target, lvl) {
    let sibling = target.previousSibling;
    if (sibling === null) {
      return;
    }

    if (parseInt(sibling.dataset.lvl) === lvl) {
      sibling.classList.add('is-match-parent');

      if (lvl !== 0) {
        showParentItem(sibling, lvl - 1);
      }
    } else {
      showParentItem(sibling, lvl);
    }
  }

  /**
   * @description Show child item of: active item
   * - parent item
   * -- active item
   * --- child item [this one]
   * --- child item [this one]
   * @param target
   * @param lvl
   */
  function showChildItemOfActiveItem(target, lvl) {
    let sibling = target.nextSibling;
    if (sibling === null) {
      return;
    }

    if (parseInt(sibling.dataset.lvl) === lvl) {
      sibling.classList.add('is-active-child');
    }

    if (parseInt(sibling.dataset.lvl) >= lvl) {
      showChildItemOfActiveItem(sibling, lvl);
    }
  }

  /**
   * @description Show parent item of active menu item
   * - parent item [this one]
   * -- active item
   * @param target
   * @param lvl
   */
  function showParentItemOfActiveItem(target, lvl) {
    let sibling = target.previousSibling;
    if (sibling === null || lvl < 0) {
      return;
    }

    if (parseInt(sibling.dataset.lvl) === lvl) {
      sibling.classList.add('is-active-parent');
      sibling.classList.add('is-open');

      showChildItemOfParentItemOfActiveItem(sibling, lvl + 1);

      if (lvl !== 0) {
        showParentItemOfActiveItem(sibling, lvl - 1);
      }
    } else {
      showParentItemOfActiveItem(sibling, lvl);
    }
  }

  /**
   * @description show Child items of: Parent Item of: Active Item
   * - parent item
   * -- child item [this one]
   * -- active item
   * --- child active item
   * --- child active item
   * -- child item [this one]
   * @param target
   * @param lvl
   */
  function showChildItemOfParentItemOfActiveItem(target, lvl) {
    let sibling = target.nextSibling;
    if (sibling === null) {
      return;
    }

    if (parseInt(sibling.dataset.lvl) === lvl) {
      sibling.classList.add('is-active-parent-sibling');
    }

    if (parseInt(sibling.dataset.lvl) >= lvl) {
      showChildItemOfParentItemOfActiveItem(sibling, lvl);
    }
  }

  /**
   * @description show Child items of: Parent Item of: Active Item
   * - parent item
   * -- child item [this one]
   * -- active item
   * --- child active item
   * --- child active item
   * -- child item [this one]
   * @param target
   * @param lvl
   */
  function showChildItemOfTarget(target, lvl) {
    let sibling = target.nextSibling;
    if (sibling === null) {
      return;
    }

    if (parseInt(sibling.dataset.lvl) === lvl) {
      sibling.classList.add('is-active-target');
    }

    if (parseInt(sibling.dataset.lvl) >= lvl) {
      showChildItemOfTarget(sibling, lvl);
    }
  }

  /**
   * @description hide Child items of: Parent Item of: Active Item
   * - parent item
   * -- child item [this one]
   * -- active item
   * --- child active item
   * --- child active item
   * -- child item [this one]
   * @param target
   * @param lvl
   */
  function hideChildItemOfTarget(target, lvl) {
    let sibling = target.nextSibling;
    if (sibling === null) {
      return;
    }

    if (parseInt(sibling.dataset.lvl) >= lvl) {
      sibling.classList.remove('is-active-child');
      sibling.classList.remove('is-active-parent');
      sibling.classList.remove('is-active-parent-sibling');
      sibling.classList.remove('is-active-current');
      sibling.classList.remove('is-active-target');
      sibling.classList.remove('is-open');
      hideChildItemOfTarget(sibling, lvl);
    }
  }

  function toggleTree(target, lvl){
    if(target.classList.contains('is-open')){
      target.classList.remove('is-open');
      hideChildItemOfTarget(target,lvl);
    }else{
      target.classList.add('is-open');
      showChildItemOfTarget(target,lvl);
    }
  }
})();
