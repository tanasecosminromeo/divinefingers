'use babel';

import DivineStatusBar from './views/divine/status-bar'

export default {
  activate(state) {},

  deactivate() {
    if (this.divineStatusBar)
      this.atomClockView.destroy()
  },

  consumeStatusBar(statusBar) {
    this.divineStatusBar = new DivineStatusBarView(statusBar)
  }

}
