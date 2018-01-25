const PropTypes = require(`prop-types`);
const React = require(`react`);

const { omit } = require(`./utils`);

const propTypes = {
	index: PropTypes.number.isRequired,
	component: PropTypes.func.isRequired
};

const propKeys = Object.keys(propTypes);

module.exports = class SortableElement extends React.Component {
	static contextTypes = {
		manager: PropTypes.object.isRequired
	};

	static propTypes = propTypes;

	constructor(props){
		super(props);

		this.index = props.index;
	}

	get manager(){
		return this.context.manager;
	}

	getRef = ref => this.ref = ref;

	componentDidMount(){
		this.setDraggable();
	}

	componentWillReceiveProps(nextProps){
		if(this.index !== nextProps.index && this.ref){
			this.removeDraggable();
			this.setDraggable(nextProps.index);

			this.index = nextProps.index;
		}
	}

	componentWillUnmount(){
		this.removeDraggable();
	}

	setDraggable(index: number = this.index){
		this.ref.sortableInfo = this;
		this.context.manager.add(index, this.ref);
	}

	removeDraggable(index: number = this.index){
		this.context.manager.remove(index, this.ref);
	}

	render(){
		const { component: Component } = this.props;

		return <Component {...omit(this.props, propKeys)} getRef={this.getRef} />;
	}
};