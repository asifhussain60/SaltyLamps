// Classic script: recovery remains usable when the application module cannot load.
(function () {
  var panel = document.getElementById('startup-status')
  var message = document.getElementById('startup-message')
  var retry = document.getElementById('startup-retry')
  if (!panel || !message || !retry) return
  function recover() {
    panel.hidden = false
    message.textContent = 'The page could not finish loading. Check your connection, then reload. You may need to sign in again.'
    retry.hidden = false
  }
  var timer = setTimeout(recover, 15000)
  retry.addEventListener('click', function () { window.location.reload() })
  window.addEventListener('salty:ready', function () { clearTimeout(timer); panel.hidden = true }, { once: true })
  window.addEventListener('error', function (event) {
    if (event.target && event.target.tagName === 'SCRIPT') recover()
  }, true)
  window.addEventListener('vite:preloadError', function () {
    panel.hidden = false
    recover()
  })
}())
