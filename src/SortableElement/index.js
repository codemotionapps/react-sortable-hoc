const invariant = require(`invariant`);
const PropTypes = require(`prop-types`);
const React = require(`react`);
const { Component } = React;
const { findDOMNode } = require(`react-dom`);

const { omit } = require(`../utils`);

const propTypes = {
	index: PropTypes.number.isRequired,
	config: PropTypes.object,
	component: PropTypes.func.isRequired,
	disabled: PropTypes.bool
};

const propKeys = Object.keys(propTypes);

module.exports = class extends Component {
	static contextTypes = { // eslint-disable-line no-undef
		manager: PropTypes.object.isRequired
	};

	static propTypes = propTypes;

	static defaultProps = { // eslint-disable-line no-undef
		config: {withRef: false}
	};

	componentDidMount(){
		const { index } = this.props;

		this.setDraggable(index);
	}

	componentWillReceiveProps(nextProps){
		if(this.props.index !== nextProps.index && this.node){
			this.node.sortableInfo.index = nextProps.index;
		}
	}

	componentWillUnmount(){
		this.removeDraggable();
	}

	setDraggable(index){
		const node = this.node = findDOMNode(this);

		node.sortableInfo = {
			index,
			manager: this.context.manager
		};

		this.ref = {node};
		this.context.manager.add(this.ref);
	}

	removeDraggable(){
		this.context.manager.remove(this.ref);
	}

	getWrappedInstance(){
		invariant(
			this.props.config.withRef,
			`To access the wrapped instance, you need to pass in {withRef: true} as the second argument of the SortableElement() call`
		);
		return this.refs.wrappedInstance;
	}

	render(){
		const { component: Component, config } = this.props;

		const ref = config.withRef ? `wrappedInstance` : null;

		return <Component ref={ref} {...omit(this.props, propKeys)} />;
	}
};