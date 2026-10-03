const button = document.querySelector('#bookmark')
const dialog = document.querySelector('#bookmark-help')
button.addEventListener('click', () => dialog.showModal())
for (const close of dialog.querySelectorAll('.close, .close-dialog')) {
  close.addEventListener('click', () => dialog.close())
}
dialog.addEventListener('close', () => button.focus())
