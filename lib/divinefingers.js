'use babel';

import FS from 'fs-plus';
import Path from 'path';
import ignore from 'ignore';
import Client from './client';
import TreeView from './views/tree-view';
import FuzzyView from './views/fuzzy-view';
//import FuzzyServerView from './views/fuzzy-server';
import { hasProject } from './helpers';
import initCommands from './menus/main';

import DivineStatusBar from './views/divine/status-bar'

import { CompositeDisposable } from 'atom';

const atom = global.atom;
const config = require('./config-schema.json');

class Main {

  constructor() {
    const self = this;
    self.config = config;
    self.treeView = null;
    self.client = null;
    self.listeners = [];
    self.FuzzyView = null;
		self.FuzzyServerView = null;
    self.grepModal = null;
		
		global.dff = { 
			self: this, 
			crypto: require('crypto'),
			ssh2: null 
		};
		
		//Keep alive
		// setTimeout(this.testconnection, 1000);
  }
	
	testconnection() {
		if (atom.project.divinefingers.root.client.status!=="CONNECTED") { setTimeout(this, 1000); return false; }
		global.dff.keepalive = "";
		
		global.dff.ssh2.exec("echo stillalive", function(err, stream) {
			if (atom.project.divinefingers.root.client.status!=="CONNECTED") { setTimeout(this, 1000); return false; }
			
			stream.on('data', function(data) { global.dff.keepalive += String(data); }).on('error', function (err){ console.log(err); }).on('end', function (){
				if (global.dff.keepalive.indexOf("stillalive")<0){
					atom.notifications.addWarning("Please check the connection <<"+global.dff.keepalive+">>", { dismissable: true });
					global.dff.divineStatusBar.setStatusColor("warning");
				} else {
					global.dff.divineStatusBar.setStatusColor("success");
				}
			});
		});
	}

  activate() {
    const self = this;

    self.client = new Client();
    atom.project['divinefingers-main'] = self; // change divinefingers to object containing client and main?
    atom.project.divinefingers = self.client;
    self.treeView = new TreeView();

    self.treeView.detach();
		
    
    this.FuzzyView = new FuzzyView();
    this.grepModal = atom.workspace.addModalPanel({ item: this.FuzzyView, visible: false });
    
    //this.FuzzyServerView = new FuzzyServerView();
    //this.dff.fuzzyServerModal = atom.workspace.addModalPanel({ item: this.FuzzyServerView, visible: false });
		
    global.dff.grepModal = this.grepModal;

    // Events subscribed to in atom's system can be easily cleaned up with a CompositeDisposable
    this.subscriptions = new CompositeDisposable();
    
    // Register command that toggles this view
    this.subscriptions.add(atom.commands.add('atom-workspace', {
      'divinefingers:toggleFind': () => this.toggleFind()
    }));

    self.client.on('connected', () => {
      self.treeView.root.name.attr('data-name', Path.basename(self.client.root.remote));
      self.treeView.root.name.attr('data-path', self.client.root.remote);
    });


    // NOTE: if there is a project folder & show view on startup
    //  is true, show the Remote FTP sidebar

    if (hasProject()) {
      // NOTE: setTimeout is for when multiple hosts option is true
      setTimeout(() => {
        FS.exists(self.client.getConfigPath(), (exists) => {
          if (exists && atom.config.get('divinefingers.showViewOnStartup')) {
            self.treeView.attach();
          }
          
          atom.project.divinefingers.readConfig(function () {
    				atom.project.divinefingers.connect();
    			});
        });
      }, 0);
    }

    // NOTE: Adds commands to context menus and atom.commands
    initCommands();

    atom.workspace.observeTextEditors((ed) => {
      const buffer = ed.buffer;
      const listener = buffer.onDidSave(self.fileSaved.bind(self));
      self.listeners.push(listener);
    });

    self.listeners.push(atom.project.onDidChangePaths(() => {
      if (!hasProject() || !self.client.isConnected()) return;
      atom.commands.dispatch(atom.views.getView(atom.workspace), 'divinefingers:disconnect');
      atom.commands.dispatch(atom.views.getView(atom.workspace), 'divinefingers:connect');
    }));
  }

  deactivate() {
    const self = this;
    self.listeners.forEach(listener => listener.dispose());
    self.listeners = [];
    if (self.client) self.client.disconnect();
  }

  fileSaved(text) {
    const self = this;
    if (!hasProject()) return;

    if (atom.config.get('divinefingers.autoUploadOnSave') === 'never') return;

    if (!self.client.isConnected() && atom.config.get('divinefingers.autoUploadOnSave') !== 'always') return;

    const local = text.path;

    if (!atom.project.contains(local)) return;

    if (local === self.client.getConfigPath()) { //If you edit the config path
			if (atom.project.divinefingers.root.client.status!=="CONNECTED") return;
			
			let editors = atom.workspace.getTextEditors();
			let activeEditor = atom.workspace.getActiveTextEditor();
			for (i in editors){
				if (editors[i]!==activeEditor){
					editors[i].destroy();
				}
			}
			
			atom.project.divinefingers.disconnect();
			atom.project.divinefingers.readConfig((err) => {
				if (err !== null) { self.status = 'NOT_CONNECTED'; return; }
				setTimeout(function (){ atom.project.divinefingers.connect(); }, 1000);
			});
			
			return;
		}
    // TODO: Add fix for files which are uploaded from a glob selector
    // don't upload files watched, they will be uploaded by the watcher
    // doesn't work fully with new version of watcher
    if (self.client.watch.files.indexOf(local) >= 0) return;

    self.client.upload(local, () => {
      try {
        const remote = self.client.toRemote(local);
        const parent = self.client.resolve(Path.dirname(remote)
          .replace(/\\/g, '/'));
        if (parent) parent.open();
      } catch (e) {}
    });
  }

  toggleFind() {
  	 if (atom.project.divinefingers.root.client.info==null){ return false; }
     if (atom.project.divinefingers.root.client.info.protocol!="sftp"){
       atom.notifications.addError("Cannot use GREP if not connected via SFTP", { dismissable: false });
       return false;
     }
    
    if (this.grepModal.isVisible()){
      this.grepModal.hide();
    } else {
      global.dff.last = "";
      global.dff.type = "";
      this.grepModal.show();
      if (global.dff.filterEditorView){
        global.dff.filterEditorView.focus();
      }
    }
  }

  toggleServer() {
    if (this.dff.fuzzyServerModal.isVisible()){
      this.dff.fuzzyServerModal.hide();
    } else {
      this.dff.fuzzyServerModal.show();
      if (global.dff.filterEditorView){
        global.dff.filterEditorView.focus();
      }
    }
  }

  omitIgnored(locals) {
    // NOTE: only works with first project path (for now)
    // see https://github.com/atom/atom/issues/5613
    const self = this;
    const ftpignore = self.client.getFilePath('.ftpignore');
    // NOTE: only works with direct specification of file/folder and no duplicate names
    const filteredLocals = ignore()
      .addIgnoreFile(ftpignore)
      .filter(locals);

    return filteredLocals;
  }
	
  consumeStatusBar(statusBar) {
    global.dff.divineStatusBar = new DivineStatusBar(statusBar)
		global.dff.divineStatusBar.start();
  }

}

export default new Main();
