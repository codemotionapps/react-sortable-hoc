import PropTypes from 'prop-types';
import React from 'react';

import { omit } from './utils';

const propTypes = {
	index: PropTypes.number.isRequired,
	component: PropTypes.func.isRequired
};

const propKeys = Object.keys(propTypes);

export default class SortableElement extends React.Component {
	static contextTypes = {
		manager: PropTypes.object.isRequired,
		childSetDraggable: PropTypes.bool.isRequired
	};

	static propTypes = propTypes;

	constructor(props){
		super(props);

		this.index = props.index;
	}

	_draggable = false;

	binds = {
		getRef: this.getRef.bind(this),
		setDraggable: this.setDraggable.bind(this),
		removeDraggable: this.removeDraggable.bind(this)
	};

	get manager(){
		return this.context.manager;
	}

	getRef(ref){
		this.ref = ref;
		if(this._draggable && ref){
			this.removeDraggable();
			this.setDraggable();
		}
	}

	componentDidMount(){
		!this.context.childSetDraggable && this.setDraggable();
	}

	componentWillReceiveProps(nextProps){
		if(this.index !== nextProps.index){
			if(this._draggable && this.ref){
				this.removeDraggable();
				this.setDraggable(nextProps.index);
			}

			this.index = nextProps.index;
		}
	}

	componentWillUnmount(){
		this.removeDraggable();
	}

	setDraggable(index: ?number = this.index){
		this._draggable = true;
		this.ref.sortableInfo = this;
		this.context.manager.add(index, this.ref);
	}

	removeDraggable(){
		this._draggable = false;
		this.context.manager.remove(this.index, this.ref);
	}

	render(){
		const props = {
			...omit(this.props, propKeys),
			getRef: this.binds.getRef
		};

		if(this.context.childSetDraggable){
			props.setDraggable = this.binds.setDraggable;
			props.removeDraggable = this.binds.removeDraggable;
		}

		return React.createElement(this.props.component, props);
	}
}