import { noop } from './utils';

class Nodes {
	map(mapper){
		const mapped = [];

		for(const i in this){
			mapped.push(mapper(this[i], Number(i)));
		}

		return mapped;
	}

	get length(){
		return Object.keys(this).length;
	}
}

export default class Manager {
	nodes = new Nodes();
	onInsert = noop;

	constructor(list){
		this.list = list;
	}

	add(index: number, node: HTMLElement){
		this.nodes[index] = node;
		this.onInsert(index);
	}

	remove(index: number, node: HTMLElement){
		this.nodes[index] === node && delete this.nodes[index];
	}

	get isActive(){
		return Boolean(this.active);
	}

	get activeIndex(){
		return this.active && this.active.index;
	}

	get activeNode(){
		if(!this.active) return null;

		return this.nodes[this.active.index];
	}
}