(function () {
  //
  documentReady(function () {
    const $darkmodeToggle = document.querySelector(`[data-darkmode-toggle]`);
    $darkmodeToggle.addEventListener('click', toggleDarkMode, false);
  });

  function toggleDarkMode() {
    const darkmodeClass = 'darkmode'
    const html = document.documentElement;
    if(html.classList.contains(darkmodeClass)){
      html.classList.remove(darkmodeClass);
      localStorage.setItem('darkmode', false);
    }else {
      html.classList.add(darkmodeClass);
      localStorage.setItem('darkmode', true);
    }
  }
}());
