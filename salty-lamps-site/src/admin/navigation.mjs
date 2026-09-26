// Shared by the lazy admin editor and the root router. Track actual history entries
// so cancelling Back restores the same entry instead of creating a duplicate one.
export const dirtyForms = new Set()
export const allowLeave = () => !dirtyForms.size || window.confirm('Discard unsaved changes?')
const positionKey = 'saltyLampsHistoryPosition'
export function installHistoryGuard() {
  const history = window.history
  const originalPush = history.pushState
  const originalReplace = history.replaceState
  let position = Number.isInteger(history.state?.[positionKey]) ? history.state[positionKey] : 0
  let restoring = false
  originalReplace.call(history, { ...history.state, [positionKey]: position }, '')
  history.pushState = function(state, title, url) {
    originalPush.call(this, { ...state, [positionKey]: position + 1 }, title, url)
    position += 1
  }
  history.replaceState = function(state, title, url) {
    originalReplace.call(this, { ...state, [positionKey]: position }, title, url)
  }
  const onPop = event => {
    // App navigation already checked allowLeave before pushState.
    if (!event.isTrusted) return
    const next = history.state?.[positionKey]
    if (restoring) { restoring = false; event.stopImmediatePropagation(); return }
    if (!Number.isInteger(next)) return
    if (next !== position && !allowLeave()) {
      event.stopImmediatePropagation()
      restoring = true
      history.go(position - next)
      return
    }
    position = next
  }
  window.addEventListener('popstate', onPop, true)
  return () => {
    history.pushState = originalPush
    history.replaceState = originalReplace
    window.removeEventListener('popstate', onPop, true)
  }
}
