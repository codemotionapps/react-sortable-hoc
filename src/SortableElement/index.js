const invariant = require(`invariant`);
const PropTypes = require(`prop-types`);
const React = require(`react`);
const { Component } = React;
const { findDOMNode } = require(`react-dom`);

const { omit } = require(`../utils`);

module.exports = class extends Component {
	static contextTypes = { // eslint-disable-line no-undef
		manager: PropTypes.object.isRequired
	};

	static propTypes = { // eslint-disable-line no-undef
		index: PropTypes.number.isRequired,
		config: PropTypes.object,
		component: PropTypes.func.isRequired,
		collection: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
		disabled: PropTypes.bool
	};

	static defaultProps = { // eslint-disable-line no-undef
		collection: 0,
		config: {withRef: false}
	};

	componentDidMount() {
		const {collection, disabled, index} = this.props;

		if (!disabled) {
			this.setDraggable(collection, index);
		}
	}

	componentWillReceiveProps(nextProps) {
		if (this.props.index !== nextProps.index && this.node) {
			this.node.sortableInfo.index = nextProps.index;
		}
		if (this.props.disabled !== nextProps.disabled) {
			const {collection, disabled, index} = nextProps;
			if (disabled) {
				this.removeDraggable(collection);
			} else {
				this.setDraggable(collection, index);
			}
		} else if (this.props.collection !== nextProps.collection) {
			this.removeDraggable(this.props.collection);
			this.setDraggable(nextProps.collection, nextProps.index);
		}
	}

	componentWillUnmount() {
		const {collection, disabled} = this.props;

		if (!disabled) this.removeDraggable(collection);
	}

	setDraggable(collection, index) {
		const node = (this.node = findDOMNode(this));

		node.sortableInfo = {
			index,
			collection,
			manager: this.context.manager
		};

		this.ref = {node};
		this.context.manager.add(collection, this.ref);
	}

	removeDraggable(collection) {
		this.context.manager.remove(collection, this.ref);
	}

	getWrappedInstance() {
		invariant(
			this.props.config.withRef,
			'To access the wrapped instance, you need to pass in {withRef: true} as the second argument of the SortableElement() call'
		);
		return this.refs.wrappedInstance;
	}

	render() {
		const { component: Component, config } = this.props;

		const ref = config.withRef ? 'wrappedInstance' : null;

		return <Component
			ref={ref}
			{...omit(this.props, 'component', 'config', 'collection', 'disabled', 'index')}
		/>;
	}
};