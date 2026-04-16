/**
 * Injected into the WebView via Capacitor's `addListener` bridge.
 * Exposes `window.orinMobile` so orinai.org knows it's in mobile shell.
 */
(function () {
  if (window.orinMobile) return; // already injected

  window.orinMobile = {
    version: 1,
    shell: 'mobile',

    // Show native approval dialog for a task
    requestApproval: function (task) {
      return new Promise(function (resolve) {
        // In production: call Capacitor plugin for native dialog
        const ok = window.confirm(
          'Orin AI wants to run on your PC:\n\n' + task.label + '\n\nAllow?'
        );
        resolve({ approved: ok });
      });
    },

    // Trigger haptic feedback
    haptic: function () {
      if (navigator.vibrate) navigator.vibrate(50);
    },
  };

  // Signal to orinai.org that we're in mobile shell
  window.dispatchEvent(new CustomEvent('orin-mobile-ready', {
    detail: { shell: 'mobile', version: 1 },
  }));
})();
