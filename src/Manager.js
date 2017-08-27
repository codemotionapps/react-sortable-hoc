const find = require(`lodash.find`);
const sortBy = require(`lodash.sortby`);

module.exports = class {
	refs = []; // eslint-disable-line no-undef

	add(ref){
		this.refs.push(ref);
	}

	remove(ref){
		const index = this.getIndex(ref);

		if(index !== -1){
			this.refs.splice(index, 1);
		}
	}

	isActive(){
		return this.active;
	}

	getActive(){
		if(!this.active) return null;

		return find(
			this.refs,
			({node}) => node.sortableInfo.index === this.active.index
		) || this.refs.slice(-1).pop();
	}

	getIndex(ref){
		return this.refs.indexOf(ref);
	}

	getOrderedRefs(){
		return sortBy(this.refs, ({node}) => node.sortableInfo.index);
	}
};