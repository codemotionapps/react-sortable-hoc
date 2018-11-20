import PropTypes from 'prop-types';
import React from 'react';
import ReactDOM from 'react-dom';

import Manager from './Manager';

export default class DropZone extends React.Component {
	static propTypes = {
		dragLayer: PropTypes.object.isRequired,
		onSortEnd: PropTypes.func.isRequired,
		onSortSwap: PropTypes.func.isRequired
	};

	isActive = false;
	manager = new Manager(this);

	handlePress(){
		this.initialWindowScroll = {
			top: window.scrollY,
			left: window.scrollX
		};

		this.isActive = true;
		this.forceUpdate();
	}

	handleSortEnd(e, newList, newIndex = 0){
		if(!this.manager.active){
			console.warn(`there is no active node`, e);
			return;
		}

		this.manager.active = null;

		const { onSortEnd } = this.props;

		onSortEnd({
			oldIndex: 0,
			newIndex,
			newList
		}, e);

		this.isActive = false;
		this.forceUpdate();
	}

	handleSortMove(){}

	handleSortSwap(index, item){
		const { onSortSwap } = this.props;
		onSortSwap({
			index,
			item
		});
	}

	render(){
		return this.props.render(this.isActive);
	}

	componentDidMount(){
		this.scrollContainer = this.container = ReactDOM.findDOMNode(this);

		this.props.dragLayer.addRef(this);
	}

	componentWillUnmount(){
		delete this.container;
		delete this.scrollContainer;

		this.props.dragLayer.removeRef(this);
	}
}