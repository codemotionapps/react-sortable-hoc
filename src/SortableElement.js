const PropTypes = require(`prop-types`);
const React = require(`react`);
const { Component } = React;
const { findDOMNode } = require(`react-dom`);

const { omit } = require(`./utils`);

const propTypes = {
	index: PropTypes.number.isRequired,
	component: PropTypes.func.isRequired
};

const propKeys = Object.keys(propTypes);

module.exports = class extends Component {
	static contextTypes = {
		manager: PropTypes.object.isRequired
	};

	static propTypes = propTypes;

	constructor(props){
		super(props);

		this.index = this.props.index;
	}

	componentDidMount(){
		this.setDraggable(this.index);

		const manager = this.context.manager;
		if(manager.isActive){
			manager.list.animateNode(this.node, this.index);
		}
	}

	componentWillReceiveProps(nextProps){
		if(this.index !== nextProps.index && this.node){
			this.setDraggable(nextProps.index);
			this.removeDraggable(this.index);

			this.index = nextProps.index;
		}
	}

	componentWillUnmount(){
		this.removeDraggable(this.index);
	}

	setDraggable(index: number){
		const node = this.node || (this.node = findDOMNode(this));

		node.sortableInfo = {
			index,
			manager: this.context.manager
		};

		this.context.manager.add(index, node);
	}

	removeDraggable(index: number){
		this.context.manager.remove(index, this.node);
	}

	render(){
		const { component: Component } = this.props;

		return <Component {...omit(this.props, propKeys)} />;
	}
};