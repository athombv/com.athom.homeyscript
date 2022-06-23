(function () {
  "use strict"

  documentReady(function () {
    const $hashLinks = document.querySelectorAll(`[data-hash-link]`);

    Array.from($hashLinks).forEach(($hashLink) => {
      $hashLink.addEventListener('click', function (event) {
        event.preventDefault();

        navigator.clipboard.writeText($hashLink.href);
        history.pushState({}, $hashLink.href, $hashLink.href);
        window.dispatchEvent(new CustomEvent('hash-highlight'));

        const id = $hashLink.href.split('#')[1];
        document.getElementById(id).scrollIntoView({
          behavior: "smooth",
        });

        const toastMessage = document.createElement('div');
        toastMessage.classList.add('toastmessage');
        toastMessage.textContent += 'Link copied to clipboard:';

        const toastLink = document.createElement('div');
        toastLink.classList.add('toastmessage__link');
        toastLink.textContent += $hashLink.href;
        toastMessage.appendChild(toastLink);
        document.body.appendChild(toastMessage);

        setTimeout(function () {
          document.body.removeChild(toastMessage)
        }, 4000);
      })
    });
  });
})();
