class Nodes {
	map(mapper){
		const mapped = [];

		for(const i in this){
			mapped.push(mapper(this[i], i));
		}

		return mapped;
	}

	get length(){
		return Object.keys(this).length;
	}
}

module.exports = class {
	nodes = new Nodes();

	constructor(list){
		this.list = list;
	}

	add(index: number, node: HTMLElement){
		this.nodes[index] = node;
	}

	remove(index: number, node: HTMLElement){
		this.nodes[index] === node && delete this.nodes[index];
	}

	get isActive(){
		return Boolean(this.active);
	}

	getActive(){
		if(!this.active) return null;

		return this.nodes[this.active.index];
	}
};