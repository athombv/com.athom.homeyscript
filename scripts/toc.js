(function () {
  "use strict"

  documentReady(function () {
    const $toc = document.getElementsByClassName('toc');
    shouldStickyBeDisabled($toc[0]);

    /* Table of content scroll to links */
    const tocLinks = document.getElementsByClassName('toc__link');
    let hashCheck = false;

    Array.from(tocLinks).forEach(($tocLink) => {
      $tocLink.addEventListener("click", function (event) {
        event.preventDefault();

        const id = this.href.split('#')[1];
        // set parameter to check if hash hasn't changed meanwhile
        hashCheck = id;

        document.getElementById(id).scrollIntoView({
          behavior: "smooth"
        });

        history.pushState({}, this.href, this.href);
        window.dispatchEvent(new CustomEvent('hash-highlight'));
      });
    });
  })

  /**
   * @param target
   * @description Disable position sticky when the TOC is to long to fit in the current viewport
   */
  function shouldStickyBeDisabled(target){
    if(!target){
      return;
    }

    let options = {
      root: null,
      rootMargin: '0px',
      threshold: 1.0
    }

    let callback = (entries, observer) => {
      entries.forEach(entry => {
        if(!entry.isIntersecting){
          target.classList.add('disable-sticky');
        }else{
          target.classList.remove('disable-sticky');
        }
      });
    };
    let observer = new IntersectionObserver(callback, options);

    observer.observe(target);
  }
})();
