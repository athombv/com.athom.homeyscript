(function () {

  documentReady(function () {
    setHighlight();

    window.addEventListener('hash-highlight', () => {
      setHighlight()
    });
  });

  function setHighlight() {
    const id = window.location.hash.split('#')[1];

    const component = document.getElementById(id);
    if (component) {
      component.classList.add('is-highlight');
    }

    setTimeout(function () {
      component.classList.remove('is-highlight');
    }, 700);
  }


}());
