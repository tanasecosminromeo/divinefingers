'use babel';

import { $, View } from 'space-pen';
import { SelectListView } from 'atom-space-pen-views';
import { exec } from 'child_process';
//import StatusMessage from './status-message';
import { Point } from 'atom';

export default class FuzzyView extends SelectListView {
	
	initialize() {
		super.initialize(...arguments);
		
		global.dff.fuzzy = this;
		global.dff.cache = {};
		global.dff.stack = [];
		global.dff.lines = [];
		global.dff.calls = [];
		
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
		if (query.length<4) return;
		
		global.dff.cache[this.md5(query)] = {query: query, results: [], loaded: false};
		global.dff.stack.push(query);
		
		this.requestData();
	}
	
	requestData = () => {
		if (global.dff.stack.length==0) return;
		if (global.dff.stack.length>1) global.dff.stack = [global.dff.stack.slice(-1)[0]];
		
		if (global.dff.stack.length==1){
			let cmd = global.dff.stack[0];
			
			global.dff.stack = [];
			
			this.fuzzyExec(cmd);
		}
	}
	
	fuzzyExec = (query) => {
		if (global.dff.ssh2==null) return;
		if (global.dff.stack.length>0) return;
		
		if (global.dff.cache[this.md5(query)].loaded===true){
			this.fuzzyPopulate(global.dff.cache[this.md5(query)].results);
			
			return;
		}
		
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
		
		var cmd = "";
		
		if ((query[0]=="." && query[1]=="/") || query.substring(0, 4)=="git " || query==".ftpconfig" || query==".config"){
			if (query!=".ftpconfig" && query!=".config"){
				cmd += `cd ${client.info.remote} && ${query}`;
			}
			
			global.dff.type = "command";
		} else {
			global.dff.type = "find";
			
			var exts="";
			
			if ((query[0]+query[1])!="*."){
				if (query.indexOf("/")){
					cmd += `find ${path} -type f -iwholename *${query}* | head -15`;
				} else {
					cmd += `find ${path} -type f -iname ${query}* | head -15`;
				}
				
				exts = `--include \*.twig --include \*.php --include \*.css --include \*.scss --include \*.js`;
				
				cmd = `grep -H -r ${exts} -w -F -n -i '${query}' ${path} | head -15 && ${cmd}`;
			} else {
				var ext = query.split(" ");
				exts = `--include ${ext[0]}`;
				
				query = query.replace(`${ext[0]} `, "");
				
				cmd = `grep -H -r ${exts} -w -F -n -i '${query}' ${path} | head -15`;
			}
		}
		
		global.dff.calls.push([""]);
		global.dff.fuzzy.setLoading("Loading");
		global.dff.ssh2.exec(cmd, function(err, stream) {
	    stream.on('data', function(data) {
						data = String(data).split("\n");
						
						for (var i in data){
							global.dff.fuzzy.fuzzyPopulate(this, data[i]);
							global.dff.calls[this][global.dff.calls[this].length-1] += data[i];
							if (i<data.length-1)
								global.dff.calls[this].push("");
						}
			    }.bind(this)).on('end', function() {
						global.dff.fuzzy.setLoading();
						if (global.dff.calls[this][0]=="") global.dff.fuzzy.setError(global.dff.fuzzy.getEmptyMessage(0, 0));
					}.bind(this));
	  }.bind(global.dff.calls.length-1));
	}
	
	fuzzyPopulate = (id, item) => {
		if (global.dff.calls[id][0]=="") this.list.empty();
		if (item=="") return;
		item = item.split(":");
		
		if (item[1]){
			item = {
				path: item[0], 
				line: item[1], 
				content: (typeof item[2]!="string") ? null:item[2].replace(/\s/g, "").substring(0, 200)
			};
		} else {
			item = {
				path: item[0]
			};
		}
		
		var itemView = $(this.viewForItem(item));
				itemView.data('select-list-item', item);
		
		this.list.append(itemView);
		this.selectItemView(this.list.find('li:first'));
	}
	
	viewForItem(item) {
		if (item.line){
			return `<li><small>${item.path.replace(atom.project.divinefingers.root.client.info.remote, "")}:${item.line}<br /><small>${item.content}</small></small></li>`;
		} else {
			if (item.cmd){
				return `${item.cmd}`;
			}
			return `<li>${item.path.replace(atom.project.divinefingers.root.client.info.remote, "")}</li>`;
		}
	}
	
	confirmed(item) {
		if (global.dff.type=="find"){
			var client = atom.project.divinefingers.root.client;
			
			global.dff.grepModal.hide();
			
			global.dff.remote = item.path;
			global.dff.line   = item.line?item.line:1;
			global.dff.local  = atom.project.getPaths()[0]+item.path.replace(client.info.remote, "");
			
			console.log("Download << " + global.dff.remote + " >> to << " + global.dff.local + " >>");
			
			client.download(global.dff.remote, false, function (err) {
				if (err) { atom.notifications.addError(err, { dismissable: false }); return; }
				
				atom.open({pathsToOpen: [global.dff.local+":"+global.dff.line], newWindow: false});
			});
		} else {
			global.dff.grepModal.hide();
		}
	}
	
	cancelled() {
		if (global.dff.type=="command" && global.dff.last.length>3){
			if (global.dff.last==".ftpconfig" || global.dff.last==".config"){
				atom.workspace.open(atom.project.getPaths()[0]+".ftpconfig").done();
				return;
			}
			
			atom.notifications.addInfo("Running "+global.dff.last.replace(`cd ${atom.project.divinefingers.root.client.info.remote} && `, ""), { dismissable: true }); 
			this.hyper_exec(global.dff.last, true);
		}
		
		global.dff.grepModal.hide();
		return console.log("This view was cancelled. Last cmd "+global.dff.last);
	}
}
