'use babel';

import { $, View } from 'space-pen';
import { SelectListView } from 'atom-space-pen-views';
import { exec } from 'child_process';
//import StatusMessage from './status-message';
import { Point } from 'atom';

export default class FuzzyView extends SelectListView {
  
 initialize() {
   super.initialize(...arguments);
   
   global.dff = { self: this };
	 global.dff.self.removeClass('loading');
   global.dff.cache = {};
   global.dff.stack = [];
	 
	 global.dff.filterEditorView = this.filterEditorView;
	 global.dff.hyperView = this;
   
	 this.setError(null);
      
   var client = atom.project.divinefingers.root.client;
   
	 if (client.info==null){ return false; }
   if (client.info.protocol!="sftp"){ return false; }
   
   if (!client.isConnected()){
    atom.notifications.addError("Before using Hyper, please connect", { dismissable: false });
    return false;
	}
 }
 
 populateList(){
	 global.dff.filterEditorView.focus();
   
   let query = this.getFilterQuery();
	 if (query.length<4){
		 return false;
	 }
   
   global.dff.stack.push(query);
   this.hyper_cmd(query);
   //setTimeout(function (){ global.dff.hyperView.hyper_postpone(); }, 200);
  }
  
  hyper_postpone(){
    if (global.dff.stack.length==0){ return false; }
    if (global.dff.stack.length>1){
      global.dff.stack = [global.dff.stack.slice(-1)[0]];
      
      return false;
    }
    if (global.dff.stack.length==1){
      var cmd = global.dff.stack[0];
      
      global.dff.stack = [];
      
      this.hyper_cmd(cmd);
    }
  }
  
  hyper_cmd(query){
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
 	 
 	 this.hyper_exec(cmd);
  }
	
	hyper_exec(cmd, runCommand){
		global.dff.last = cmd;
		
		if (global.dff.type=="command" && runCommand!=true){ return; }
	  
    console.log(cmd);
      
		var client = atom.project.divinefingers.root.client;
		
		let command = `ssh -T -p ${client.info.port==null?21:client.info.port} ${client.info.user}@${client.info.host} "${cmd}"`;
    
		exec(command, {cwd: "/"}, (err, stdout, stderr) => {
		 if (err) { 
			 if (global.dff.type=="command"){
				var err = (err+" ").split("\n");
				atom.notifications.addError("Failed to run "+err[1]?err[1]:global.dff.last.replace(`cd ${atom.project.divinefingers.root.client.info.remote} && `, ""), { dismissable: false });
			 }
			 
			 return; 
     } // no item
		 if (stderr) { return; }
		 var lines = this.parseFind(stdout);
		 
		 this.list.empty();
		 
		 if (lines.length){
		   this.setError(null);
		   lines.reverse();
				
		   for (var i in lines){
		     var item = lines[i];
		     var itemView = $(this.viewForItem(item));
		         itemView.data('select-list-item', item);
		         
		     this.list.append(itemView);
		     this.selectItemView(this.list.find('li:first'));
		   }
		 } else {
		   return this.setError(this.getEmptyMessage(0, 0));
		 }
		});
	}
  
  parseFind(stdout){
		var result = [];
		if (global.dff.type!="command"){
	    var data = stdout.split('\n');
	    for (var i in data) {
	      if (data[i].length > 5) {
	          var line = data[i].split(":");
						
						if (line[1]){
	          	result.push({path: line[0], line: line[1], content: (typeof line[2]!="string")?null:line[2].replace(/\s/g, "").substring(0, 200)});
						} else {
							result.push({path: line[0]});
						}
	      }
	    }
    } else {
			atom.notifications.addSuccess("<small>"+stdout.replace(/\n/g, "<br />")+"</small>", { dismissable: true }); 
		}
		
    return result;
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
