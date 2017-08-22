const find = require(`lodash.find`);
const sortBy = require(`lodash.sortby`);

module.exports = class {
	refs = {}; // eslint-disable-line no-undef

	add(collection, ref){
		if(!this.refs[collection]){
			this.refs[collection] = [];
		}

		this.refs[collection].push(ref);
	}

	remove(collection, ref){
		const index = this.getIndex(collection, ref);

		if(index !== -1){
			this.refs[collection].splice(index, 1);
		}
	}

	isActive(){
		return this.active;
	}

	getActive(){
		if(!this.active) return null;
		const activeRef = this.refs[this.active.collection];
		if(!activeRef) return null;
		return find(
			activeRef,
			({node}) => node.sortableInfo.index == this.active.index // eslint-disable-line eqeqeq
		) || activeRef.slice(-1).pop();
	}

	getIndex(collection, ref){
		return this.refs[collection].indexOf(ref);
	}

	getOrderedRefs(collection = this.active.collection){
		return sortBy(this.refs[collection], ({node}) => node.sortableInfo.index);
	}
};