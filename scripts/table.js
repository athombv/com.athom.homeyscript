(function () {
  "use strict"

  documentReady(function () {
    const $tables = document.querySelectorAll(`[data-table]`);

    Array.from($tables).forEach(($table) => {
      const $collapsableRows = $table.querySelectorAll(`[data-table-collapsed]`);

      Array.from($collapsableRows).forEach(($collapsableRow) => {
        $collapsableRow.addEventListener('click', function () {
          const id = this.getAttribute(`data-table-row-id`);
          // Get collapsed status
          let currentCollapseState = this.getAttribute(`data-table-collapsed`) === 'true';
          // Set new collapsed status
          let collapsed = !currentCollapseState;
          this.setAttribute('data-table-collapsed', collapsed);

          const $children = $table.querySelectorAll(`[data-table-row-parent="${id}"]`);
          const $allChildren = $table.querySelectorAll(`[data-table-row-parent^="${id}"]`);
          const $allCollapsableChildren = $table.querySelectorAll(`[data-table-row-parent^="${id}"][data-table-collapsed]`);

          // On close close all children
          if (collapsed) {
            Array.from($allChildren).forEach(($child) => {
              $child.setAttribute('data-table-row-is-shown', !collapsed);
            });

            Array.from($allCollapsableChildren).forEach(($child) => {
              $child.setAttribute('data-table-collapsed', true);
            });
          }
          // On open only direct children
          else {
            Array.from($children).forEach(($child) => {
              $child.setAttribute('data-table-row-is-shown', !collapsed);
            });
          }
        });
      });
    });
  });
})();
