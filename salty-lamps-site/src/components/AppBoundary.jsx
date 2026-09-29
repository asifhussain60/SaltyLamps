import React, { useEffect } from 'react'

function Ready({ children }) {
  useEffect(() => { window.dispatchEvent(new Event('salty:ready')) }, [])
  return children
}

export default class AppBoundary extends React.Component {
  state = { failed: false }
  static getDerivedStateFromError() { return { failed: true } }
  componentDidCatch() { window.dispatchEvent(new Event('salty:ready')) }
  render() {
    if (this.state.failed) return <main className="app-recovery" role="alert">
      <h1>We could not display this page.</h1>
      <p>Your saved basket has not been cleared. Reload the page to try again.</p>
      <button className="button primary" onClick={() => window.location.reload()}>Reload page</button>
    </main>
    return <Ready>{this.props.children}</Ready>
  }
}
