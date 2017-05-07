'use babel';

import { $, View } from 'space-pen';
import { SelectListView } from 'atom-space-pen-views';
import { exec } from 'child_process';
import { Point } from 'atom';
import { htmlEscape } from './../helpers';

export default class FuzzyServerView extends SelectListView {
	
	initialize() {
		super.initialize(...arguments);
		
		this.addClass("df-fuzzy-view");
		this.setLoading();		
		this.setError(null);
	}
	
	populateList(){
		console.log("populateList");
		// this.filterEditorView.focus();
		// 
		// let query = this.getFilterQuery();
		// if (query.length<3) return this.fuzzyClean();
		// 	
		// this.fuzzyExec(cmd);
	}
	
	fuzzyExec(query){
		console.log("fuzzyExec", query);
	}
	
	fuzzyClean() {
		console.log("populateList");
		// this.setLoading();
		// this.list.empty();
		// this.setError(null);
	}
	
	fuzzyPopulate(id, item){
		if (item==="") return;
		
		let remote = "";//atom.project.remoteftp.root.client.info.remote;
		
		item = item.split(":");
		
		if (item[1]){
			item = {
				path: item[0], 
				path_clean: item[0].replace(remote, ""),
				line: item[1], 
				content: (typeof item[2]!="string") ? null: htmlEscape(item.slice(2).join().replace(/(\s)+/g, " ").substring(0, 200))
			};
		} else {
			item = {
				path: item[0],
				path_clean: item[0].replace(remote, ""),
			};
		}
		
		var itemView = $(this.viewForItem(item));
				itemView.data('select-list-item', item);
		
		this.list.append(itemView);
		this.selectItemView(this.list.find('li:first'));
	}
	
	viewForItem(item) {
		console.log("viewForItem", item);
		
		// if (item.line){
		// 	return `<li>${item.path_clean}<span>:${item.line}<br /><small>${item.content}</small></span></li>`;
		// } else {
		// 	if (item.cmd){
		// 		return `${item.cmd}`;
		// 	}
		// 	return `<li>${item.path_clean}</li>`;
		// }
	}
	
	confirmed(item) {
		console.log("confirmed", item);
		
		this.dff.fuzzyServerModal.hide();
		
		// var client = atom.project.divinefingers.root.client;
		// 
		// 
		// this.remote = item.path;
		// this.line   = item.line?item.line:1;
		// this.local  = atom.project.getPaths()[0]+item.path.replace(client.info.remote, "");
		// 		
		// client.download(this.remote, false, function (err) {
		// 	if (err) { atom.notifications.addError(err, { dismissable: false }); return; }
		// 	
		// 	atom.open({pathsToOpen: [this.local+":"+this.line], newWindow: false});
		// });
	}
	
	cancelled() {		
		this.fuzzyClean();
		this.dff.fuzzyServerModal.hide();
	}
}
