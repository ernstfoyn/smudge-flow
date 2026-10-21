/* Bounded snapshot history. Rendering time and UI selection do not create edits. */
(function(root){
  class EditHistory {
    constructor(limit=60){this.limit=limit;this.entries=[];this.index=-1;this.key=null;this.time=0;}
    record(state,signature,key=null,now=Date.now()){
      if(this.entries[this.index]?.signature===signature)return false;
      const branching=this.index<this.entries.length-1;
      this.entries.splice(this.index+1);
      if(!branching&&key&&key===this.key&&now-this.time<700&&this.index>0)this.entries[this.index]={state,signature};
      else {this.entries.push({state,signature});this.index++;if(this.entries.length>this.limit){this.entries.shift();this.index--;}}
      this.key=key;this.time=now;return true;
    }
    undo(){if(this.index<=0)return null;this.key=null;return this.entries[--this.index].state;}
    redo(){if(this.index>=this.entries.length-1)return null;this.key=null;return this.entries[++this.index].state;}
  }
  if(typeof module!=='undefined')module.exports=EditHistory;else root.EditHistory=EditHistory;
})(typeof globalThis!=='undefined'?globalThis:this);
