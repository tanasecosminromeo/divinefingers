'use babel';

import { $, View } from 'space-pen';
import { SelectListView } from 'atom-space-pen-views';
import { exec } from 'child_process';
import { Point } from 'atom';

export default class FuzzyView extends SelectListView {
	
	initialize() {
		super.initialize(...arguments);
		
		this.addClass("df-fuzzy-view");
		
		global.dff.fuzzy = this;
		global.dff.stack = [];
		global.dff.lines = [];
		global.dff.calls = [];
		global.dff.sshbuf = [];
		global.dff.willconnect = false;
		
		global.dff.fuzzy.setLoading();
		global.dff.filterEditorView = this.filterEditorView;
		global.dff.hyperView = this;
		
		this.setError(null);
	}
	
	md5 = (content) => {
		return global.dff.crypto.createHash('md5').update(content).digest('hex');
	}
	
	populateList(){
		global.dff.filterEditorView.focus();
		
		let query = this.getFilterQuery();
		if (query.length<3) return global.dff.fuzzy.fuzzyClean();
		
		global.dff.stack.push(query);
		
		setTimeout(this.requestData, 400);
	}
	
	requestData = () => {
		if (global.dff.stack.length==0) return;
		if (global.dff.stack.length>1) global.dff.stack = [global.dff.stack.slice(-1)[0]];
		
		switch (atom.project.divinefingers.root.client.status){
			case "NOT_CONNECTED": 
				if (global.dff.willconnect!=true){ 
					global.dff.willconnect = true; 
					atom.project.divinefingers.connect(true); 
				}
			case "CONNECTING": 
				setTimeout(this.requestData, 400); 
				
				return false;
			case "CONNECTED":
				global.dff.willconnect = false; 
		}
		
		if (global.dff.stack.length==1){
			let cmd = global.dff.stack[0];
			
			global.dff.stack = [];
			
			this.fuzzyExec(cmd);
		}
	}
	
	fuzzyExec = (query) => {
		if (global.dff.ssh2==null) return;
		if (global.dff.stack.length>0) return;
		
		var client = atom.project.divinefingers.root.client;
		var local  = atom.project.getPaths()[0];
		
		var path = client.info.remote;
		if (client.info.bundle){
			if (query[0]=="/"){
				query = query.substring(1);
			} else {
				path += client.info.bundle;
			}
		}
		
		let limit = 5;
		if (query[0]=="-"){
			limit = query.split(" ");
			limit = limit[0].substring(1);
			
			query = query.replace(`-${limit}`, "").trim();
			
			if (limit=="a"){
				limit = 1000;
			}
			
			limit = Math.floor(limit/2);
		}
		
		var cmd = `find ${path} -type f -i${query.indexOf("/")?'whole':''}name *${query}* | head -${limit}`;
		
		if ((query[0]+query[1])!="*."){
			exts = `--include \*.twig --include \*.php --include \*.css --include \*.scss --include \*.js`;
			
			cmd += " && ";
		} else {
			var ext = query.split(" ");
			exts = `--include ${ext[0]}`;
			
			query = query.replace(`${ext[0]}`, "").trim();
			cmd   = "";
		}
		
		cmd += `grep ${exts} -rinP "${global.dff.fuzzy.regExGrep(query)}" ${path} | head -${limit}`;
		
		if (query.length<3) return global.dff.fuzzy.fuzzyClean();
		
		global.dff.calls.push([""]);
		global.dff.fuzzy.setLoading("Loading");
		global.dff.buffer = "";
		global.dff.sshbuf = global.dff.ssh2.exec(cmd, function(err, stream) {
			if (typeof stream == "undefined") return false;
			
	    stream.on('data', function(data) {
						data = String(data);
						let buffId = (data.match(/\n/g) || []).length
						data = data.split("\n");
						
						for (var i in data){
							try {
								if (buffId>0) global.dff.fuzzy.fuzzyPopulate(this, global.dff.calls[this][global.dff.calls[this].length-1]+data[i]);
							} catch (e){
								console.log("Error finding ", this, ": ", e);
							}
							
							global.dff.calls[this][global.dff.calls[this].length-1] += data[i];
							if (i<data.length-1 && buffId>0)
								global.dff.calls[this].push("");
								buffId--;
						}
			    }.bind(this)).on('end', function() {
						setTimeout(function (){ global.dff.calls.shift(); /* Clean data */ }, 60000);
						
						global.dff.fuzzy.setLoading();
						if (global.dff.calls[this][0]=="") {
							global.dff.fuzzy.list.empty();
							global.dff.fuzzy.setError(global.dff.fuzzy.getEmptyMessage(0, 0));
						}
					}.bind(this));
	  }.bind(global.dff.calls.length-1));
	}
	
	fuzzyClean = () => {
		global.dff.fuzzy.setLoading();
		global.dff.fuzzy.list.empty();
		global.dff.fuzzy.setError(null);
	}
	
	regExGrep = (query) => {
		query = query.replace(new RegExp('=', 'g'), ` `)
						 		 .replace(new RegExp('\\$', 'g'), ` `)
								 .replace(new RegExp(`"`, 'g'), ` `)
								 .replace(new RegExp(`'`, 'g'), ` `)
								 .replace(new RegExp(`;`, 'g'), ` `)
								 .replace(new RegExp(`\\>`, 'g'), ` `)
								 .replace(new RegExp(`\\:`, 'g'), ` `)
								 .replace(new RegExp(`\\(`, 'g'), ` `)
								 .replace(new RegExp(`\\)`, 'g'), ` `)
								 .replace(new RegExp(`\\[`, 'g'), ` `)
								 .replace(new RegExp(`\\]`, 'g'), ` `)
								 .replace(new RegExp(`\\{`, 'g'), ` `)
								 .replace(new RegExp(`\\}`, 'g'), ` `)
								 .replace(/( )+/g, ' ')
								 .trim()
								 .replace(new RegExp(` `, 'g'), `([ \\t\\"\\'=$\\(\\[\\{\\}\\)\\]\\;\\:\\>]+)?`);
		
		return query;
	}
	
	htmlEscape = (str) => {
    return str
        .replace(/&/g, '&amp;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
	}
	
	fuzzyPopulate = (id, item) => {
		if (global.dff.calls[id][0]=="") this.list.empty();
		if (item=="") return;
		
		var client = atom.project.divinefingers.root.client;
		
		item = item.split(":");
		
		if (item[1]){
			item = {
				path: item[0], 
				path_clean: item[0].replace(client.info.remote, ""),
				line: item[1], 
				content: (typeof item[2]!="string") ? null: global.dff.fuzzy.htmlEscape(item.slice(2).join().replace(/(\s)+/g, " ").substring(0, 200))
			};
		} else {
			item = {
				path: item[0],
				path_clean: item[0].replace(client.info.remote, ""),
			};
		}
		
		var itemView = $(this.viewForItem(item));
				itemView.data('select-list-item', item);
		
		this.list.append(itemView);
		this.selectItemView(this.list.find('li:first'));
	}
	
	viewForItem(item) {
		if (item.line){
			return `<li>${item.path_clean}<span>:${item.line}<br /><small>${item.content}</small></span></li>`;
		} else {
			if (item.cmd){
				return `${item.cmd}`;
			}
			return `<li>${item.path_clean}</li>`;
		}
	}
	
	confirmed(item) {
		var client = atom.project.divinefingers.root.client;
		
		global.dff.grepModal.hide();
		
		global.dff.remote = item.path;
		global.dff.line   = item.line?item.line:1;
		global.dff.local  = atom.project.getPaths()[0]+item.path.replace(client.info.remote, "");
				
		client.download(global.dff.remote, false, function (err) {
			if (err) { atom.notifications.addError(err, { dismissable: false }); return; }
			
			atom.open({pathsToOpen: [global.dff.local+":"+global.dff.line], newWindow: false});
		});
	}
	
	cancelled() {
		global.dff.fuzzy.fuzzyClean();
		global.dff.grepModal.hide();
	}
}
