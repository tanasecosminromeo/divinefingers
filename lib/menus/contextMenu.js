'use babel';

const init = function INIT() {
  const atom = global.atom;
  const copyEnabled = () => atom.config.get('divinefingers.enableCopyFilename');
  const contextMenu = {
    '.divinefingers-view .entries.list-tree:not(.multi-select) .directory .header': {
      enabled: copyEnabled(),
      command: [{
        label: 'Copy name',
        command: 'divinefingers:copy-name',
      }, {
        type: 'separator',
      }],
    },
    '.divinefingers-view .entries.list-tree:not(.multi-select) .file': {
      enabled: copyEnabled(),
      command: [{
        label: 'Copy filename',
        command: 'divinefingers:copy-name',
      }, {
        type: 'separator',
      }],
    },
  };
  return contextMenu;
};


export default init;
