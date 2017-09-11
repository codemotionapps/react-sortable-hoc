const invariant = require(`invariant`);
const findIndex = require(`lodash.findindex`);
const PropTypes = require(`prop-types`);
const React = require(`react`);
const { Component } = React;
const { findDOMNode } = require(`react-dom`);

const DragLayer = require(`../DragLayer`);

const Manager = require(`../Manager`);
const {
	closest,
	events,
	getOffset,
	closestNode,
	getHelperBoundaries,
	dragComponentSize,
	cleanTranform,
	attributes,
	omit
} = require(`../utils`);

const propTypes = {
	axis: PropTypes.oneOf([`x`, `y`]),
	config: PropTypes.object,
	component: PropTypes.func.isRequired,
	dragLayer: PropTypes.object,
	helperClass: PropTypes.string,
	contentWindow: PropTypes.any,
	onSortStart: PropTypes.func,
	onSortEnd: PropTypes.func,
	onDragEnd: PropTypes.func,
	shouldCancelStart: PropTypes.func,
	pressDelay: PropTypes.number,
	useWindowAsScrollContainer: PropTypes.bool,
	lockOffset: PropTypes.oneOfType([
		PropTypes.number,
		PropTypes.string,
		PropTypes.arrayOf(PropTypes.oneOfType([PropTypes.number, PropTypes.string]))
	]),
	getContainer: PropTypes.func,
	transitionPrefix: PropTypes.string,
	getHelperDimensions: PropTypes.func
};

const acceleration = 10;

const propKeys = Object.keys(propTypes);

module.exports = class extends Component {
	constructor(props){
		super(props);
		this.dragLayer = props.dragLayer || new DragLayer();
		this.indexInLayer = this.dragLayer.addRef(this);
		this.dragLayer.onDragEnd = props.onDragEnd;
		this.manager = new Manager();
		this.host = false;
		this.events = {
			start: this.handleStart.bind(this),
			move: this.handleMove.bind(this),
			end: this.handleEnd.bind(this)
		};

		this.state = {};
	}

	static defaultProps = {
		axis: `y`,
		config: {
			withRef: false
		},
		pressDelay: 0,
		pressThreshold: 5,
		useWindowAsScrollContainer: false,
		contentWindow: typeof window !== `undefined` ? window : null,
		shouldCancelStart(e){
			// Cancel sorting if the event target is an `input`, `textarea`, `select` or `option`
			const disabledElements = [
				`input`,
				`textarea`,
				`select`,
				`option`,
				`button`
			];

			if(disabledElements.indexOf(e.target.tagName.toLowerCase()) !== -1){
				return true; // Return true to cancel sorting
			}
		},
		lockOffset: `50%`,
		getHelperDimensions: ({node}) => ({
			width: node.offsetWidth,
			height: node.offsetHeight
		})
	};

	static propTypes = propTypes;

	static childContextTypes = {
		manager: PropTypes.object.isRequired
	};

	getChildContext(){
		return {
			manager: this.manager
		};
	}

	setInitialScroll(axis){
		this.initialScroll = this.scrollContainer[attributes.scroll[axis]];
	}

	componentDidMount(){
		const {
			contentWindow,
			getContainer,
			useWindowAsScrollContainer,
			axis
		} = this.props;

		this.dragLayer.listContainers[this.indexInLayer] = this.container = do{
			if(typeof getContainer === `function`){
				getContainer(this.getWrappedInstance());
			}else{
				findDOMNode(this);
			}
		};

		this.document = this.container.ownerDocument || document;

		this.scrollContainer = do{
			if(useWindowAsScrollContainer){
				this.document.body;
			}else{
				this.container;
			}
		};

		this.setInitialScroll(axis);
		this.contentWindow = do{
			if(typeof contentWindow === `function`){
				contentWindow();
			}else{
				contentWindow;
			}
		};

		for(const key in this.events){
			if(!this.events.hasOwnProperty(key)) continue;

			events[key].forEach(event => this.container.addEventListener(event, this.events[key], false));
		}
	}

	componentWillUnmount(){
		this.dragLayer.removeRef(this);
		for(const key in this.events){
			if(!this.events.hasOwnProperty(key)) continue;

			events[key].forEach(event => this.container.removeEventListener(event, this.events[key]));
		}
	}

	componentWillReceiveProps(nextProps){
		const {active} = this.manager;
		if(!active) return;

		this.checkActiveIndex(nextProps);
	}

	checkActiveIndex(nextProps){
		const { items } = nextProps || this.props;
		const { item } = this.manager.active;
		const newIndex = findIndex(items, item);
		if(newIndex === -1){
			this.dragLayer.stopDrag();
			return;
		}
		this.manager.active.index = newIndex;
		this.index = newIndex;
	}

	handleStart(e){
		const p = getOffset(e);
		const { shouldCancelStart, items } = this.props;

		if(e.button === 2 || shouldCancelStart(e)){
			return false;
		}

		this._touched = true;
		this._pos = p;

		const node = closest(e.target, el => Boolean(el.sortableInfo));

		if(node && node.sortableInfo && this.nodeIsChild(node) && !this.state.sorting){
			const { index } = node.sortableInfo;

			this.manager.active = {index, item: items[index]};

			// Fixes a bug in Firefox where the :active state of anchor tags prevent subsequent 'mousemove' events from being fired (see https://github.com/clauderic/react-sortable-hoc/issues/118)
			if(e.target.tagName.toLowerCase() === `a`) e.preventDefault();

			this.pressTimer = setTimeout(() => this.handlePress(e), this.props.pressDelay);
		}
	}

	nodeIsChild(node){
		return node.sortableInfo.manager === this.manager;
	}

	handleMove(e){
		const { pressThreshold } = this.props;
		const p = getOffset(e);

		if(this.state.sorting || !this._touched) return;

		this._delta = {
			x: this._pos.x - p.x,
			y: this._pos.y - p.y
		};
		const delta = Math.abs(this._delta.x) + Math.abs(this._delta.y);

		if(!pressThreshold || (pressThreshold && delta >= pressThreshold)){
			clearTimeout(this.cancelTimer);
			this.cancelTimer = setTimeout(this.cancel, 0);
		}
	}

	handleEnd(){
		this._touched = false;

		this.cancel();
	}

	cancel(){
		if(this.state && this.state.sorting) return;

		clearTimeout(this.pressTimer);
		if(this.manager) this.manager.active = null;
	}

	handlePress(e){
		this.isScrollable = this.container.isScrollable();
		let activeNode = null;
		if(this.dragLayer.helper){
			if(this.manager.active){
				this.checkActiveIndex();
				activeNode = this.manager.getActive();
			}
		}else{
			activeNode = this.dragLayer.startDrag(this.document.body, this, e);
		}

		if(activeNode){
			const {
				helperClass,
				onSortStart,
				axis
			} = this.props;
			const { node } = activeNode;
			const { index } = node.sortableInfo;

			this.index = index;
			this.newIndex = index;

			this.setInitialScroll(axis);

			this.initialWindowScroll = {
				top: window.scrollY,
				left: window.scrollX
			};

			this.sortableGhost = node;
			node.style.visibility = `hidden`;
			// node.style.transition = `none`;
			node.style.opacity = 0;

			if(helperClass) this.dragLayer.helper.classList.add(helperClass);

			this.setState({
				sorting: true
			});

			if(onSortStart) onSortStart({node, index});
		}
	}

	handleSortMove(e){
		if(!this.dragLayer.animating && this.checkActive(e)){
			this.animateNodes();
			if(this.isScrollable) this.autoscroll();
		}
	}

	handleSortEnd(e, newList, newIndex){
		this.host = false;

		const { onSortEnd } = this.props;
		if(!this.manager.active){
			console.warn(`there is no active node`, e);
			return;
		}

		if(this.sortableGhost){
			this.sortableGhost.style.visibility = ``;
			this.sortableGhost.style.opacity = ``;
			// this.sortableGhost.style.transition = ``;
		}

		const nodes = this.manager.refs;
		for(let i = 0, len = nodes ? nodes.length : 0; i < len; i++){
			const node = nodes[i];
			const el = node.node;

			// Clear the cached offsetTop / offsetLeft value
			node.edgeOffset = null;

			// Remove the transforms
			el.style.transform = ``;
		}

		// Stop autoscroll
		clearInterval(this.autoscrollInterval);

		// Update state
		this.manager.active = null;

		this.setState({
			sorting: false
		});

		if(typeof onSortEnd === `function`){
			// get the index in the new list
			if(newList){
				this.newIndex = newIndex;
			}

			onSortEnd({
				oldIndex: this.index,
				newIndex: this.newIndex,
				newList
			}, e);
		}

		this._touched = false;
	}

	handleSortSwap(index, item){
		const { onSortSwap } = this.props;
		if(typeof onSortSwap === `function`){
			onSortSwap({
				index,
				item
			});
		}
	}

	getEdgeOffset(node, offset = {top: 0, left: 0}){
		// Get the actual offsetTop / offsetLeft value, no matter how deep the node is nested
		if(node){
			const nodeOffset = {
				top: offset.top + node.offsetTop,
				left: offset.left + node.offsetLeft
			};
			if(node.parentNode !== this.container){
				return this.getEdgeOffset(node.parentNode, nodeOffset);
			}else{
				return nodeOffset;
			}
		}
	}

	getOffset(e){
		return {
			x: e.touches ? e.touches[0].pageX : e.pageX,
			y: e.touches ? e.touches[0].pageY : e.pageY
		};
	}

	getLockPixelOffsets(){
		let { lockOffset } = this.props;

		if(!Array.isArray(lockOffset)){
			lockOffset = [lockOffset, lockOffset];
		}

		invariant(lockOffset.length === 2, `lockOffset prop of SortableContainer should be a single value or an array of exactly two values. Given %s`, lockOffset);

		const [ minLockOffset, maxLockOffset ] = lockOffset;

		return [
			this.getLockPixelOffset(minLockOffset),
			this.getLockPixelOffset(maxLockOffset)
		];
	}

	getLockPixelOffset(lockOffset){
		let offsetX = lockOffset;
		let offsetY = lockOffset;
		let unit = `px`;

		if(typeof lockOffset === `string`){
			const match = /^[+-]?\d*(?:\.\d*)?(px|%)$/.exec(lockOffset);

			invariant(
				match !== null,
				`lockOffset value should be a number or a string of a ` +
					`number followed by "px" or "%". Given %s`,
				lockOffset,
			);

			offsetX = offsetY = parseFloat(lockOffset);
			unit = match[1];
		}

		invariant(isFinite(offsetX) && isFinite(offsetY), `lockOffset value should be a finite. Given %s`, lockOffset);

		if(unit === `%`){
			offsetX = offsetX * this.dragLayer.width / 100;
			offsetY = offsetY * this.dragLayer.height / 100;
		}

		return {
			x: offsetX,
			y: offsetY
		};
	}

	getClosestNode(){
		const { helper } = this.dragLayer;
		const { axis } = this.props;

		const coordinates = getHelperBoundaries(helper, axis);

		const nodes = this.manager.getOrderedRefs().map(n => n.node);

		if(nodes && nodes.length > 0){
			let nodeIndex = closestNode(coordinates, nodes, axis);

			/* eslint-disable no-var */
			if(axis === `x`){
				var cAttr = `left`; // coordinate attribute
				var sizeAttr = `width`;
			}else{
				var cAttr = `top`;
				var sizeAttr = `height`;
			}
			/* eslint-enable no-var */

			const node = nodes[nodeIndex];
			const rect = node.getBoundingClientRect();
			const boundary = rect[cAttr] + (rect[sizeAttr] / 2);

			if(nodes.length > nodeIndex && coordinates[1] > boundary) nodeIndex++;
			if(nodeIndex > 0 && coordinates[0] < boundary) nodeIndex--;

			return {
				index: nodeIndex
			};
		}

		return {
			index: 0
		};
	}

	checkActive(e){
		const active = this.manager.active;
		if(active) return true;

		const node = closest(e.target, el => Boolean(el.sortableInfo));
		if(node && node.sortableInfo){
			const nodes = this.manager.refs.map(n => n.node);

			if(nodes){
				const { helper } = this.dragLayer;
				const { axis } = this.props;

				const coordinates = getHelperBoundaries(helper, axis);
				const index = closestNode(coordinates, nodes, axis);
				this.manager.active = {
					index,
					item: this.props.items[index]
				};
				this.handlePress(e);

				return true; // Not sure, seems logical
			}
		}

		return false;
	}

	calculateReturningBoundary(boundary, name, substract, oldBoundaries){
		const { bound } = boundary;
		const boundLast = `${bound}last`;

		if(oldBoundaries[bound]){
			const sizes = this.dragBoundaries[`${name}Sizes`];
			const nodes = this.dragBoundaries[`${name}Nodes`];

			const returningNode = nodes.pop();
			returningNode.style.transform = ``;

			let halfs = sizes.pop() + sizes.last();
			if(!substract) halfs = -halfs;

			this.dragBoundaries[bound] = oldBoundaries[bound] - halfs;
		}else if(oldBoundaries[boundLast]){
			this.dragBoundaries[bound] = oldBoundaries[boundLast];
		}
	}

	calculateBoundary(boundary, name, axis, marginOffset, substract, oldBoundaries){
		const { node, next, bound } = boundary;
		if(node){
			const sizes = this.dragBoundaries[`${name}Sizes`];
			const nodes = this.dragBoundaries[`${name}Nodes`];
			const lastSize = sizes.last();

			const size = dragComponentSize(node, axis, marginOffset, next);
			sizes.push(size);
			nodes.push(node);

			let halfs = (lastSize || 0) + size;
			if(!substract) halfs = -halfs;

			this.dragBoundaries[bound] = (oldBoundaries[bound] || 0) + halfs;
		}else{
			const boundLast = `${bound}last`;
			this.dragBoundaries[boundLast] = oldBoundaries[bound];
		}
	}

	calculateDragBoundaries(index, newIndex = index, nodes = this.manager.getOrderedRefs()){
		const { axis } = this.props;
		const marginOffset = this.dragLayer.marginOffset[axis];

		const oldDragBoundaries = this.dragBoundaries || {};
		this.dragBoundaries = {};
		const differnece = index - newIndex;

		let prevIndex = index - differnece;
		if(differnece >= 0) prevIndex--;
		const prevNode = newIndex > 0 ? nodes[prevIndex].node : void 0;
		let nextIndex = index - differnece;
		if(differnece <= 0) nextIndex++;
		const nextNode = newIndex < nodes.length - 1 ? nodes[nextIndex].node : void 0;

		this.dragBoundaries.differnece = differnece;

		this.dragBoundaries.aboveNodes = oldDragBoundaries.aboveNodes;
		this.dragBoundaries.aboveSizes = oldDragBoundaries.aboveSizes;

		this.dragBoundaries.belowNodes = oldDragBoundaries.belowNodes;
		this.dragBoundaries.belowSizes = oldDragBoundaries.belowSizes;

		if(differnece === 0){
			cleanTranform(oldDragBoundaries.aboveNodes);
			cleanTranform(oldDragBoundaries.belowNodes);

			const aboveNodes = [];
			const aboveSizes = [];

			const belowNodes = [];
			const belowSizes = [];

			if(prevNode){
				const size = dragComponentSize(prevNode, axis, marginOffset, -1);
				this.dragBoundaries.prev = size;
				aboveNodes.push(prevNode);
				aboveSizes.push(size);
			}

			if(nextNode){
				const size = dragComponentSize(nextNode, axis, marginOffset, 1);
				this.dragBoundaries.next = size;
				belowNodes.push(nextNode);
				belowSizes.push(size);
			}

			this.dragBoundaries.aboveNodes = aboveNodes;
			this.dragBoundaries.aboveSizes = aboveSizes;

			this.dragBoundaries.belowNodes = belowNodes;
			this.dragBoundaries.belowSizes = belowSizes;
		}else{
			const isMovingUp = differnece > 0;
			let shouldPop = oldDragBoundaries.differnece > differnece;
			if(!isMovingUp) shouldPop ^= 1;

			const above = {
				node: prevNode,
				bound: `prev`,
				next: -1
			};
			const below = {
				node: nextNode,
				bound: `next`,
				next: 1
			};

			if(!shouldPop){ // Add nodes
				this.calculateBoundary(above, `above`, axis, marginOffset, isMovingUp, oldDragBoundaries);
				this.calculateBoundary(below, `below`, axis, marginOffset, !isMovingUp, oldDragBoundaries);
			}else{ // Remove nodes
				this.calculateReturningBoundary(above, `above`, isMovingUp, oldDragBoundaries);
				this.calculateReturningBoundary(below, `below`, !isMovingUp, oldDragBoundaries);
			}
		}

		// console.log(this.dragBoundaries);
	}

	animateNode(node){
		if(!node) return;

		const axis = this.props.axis.toUpperCase();
		const size = do{
			if(axis === `X`) this.dragLayer.width + this.dragLayer.marginOffset.x;
			else this.dragLayer.height + this.dragLayer.marginOffset.y;
		};
		const translate = `translate${axis}`;
		if(this.index > this.newIndex){ // prev
			node.style.transform = `${translate}(${size}px)`;
		}else if(this.index < this.newIndex){ // next
			node.style.transform = `${translate}(${-size}px)`;
		}else{
			node.style.transform = ``;
		}
	}

	animateNodes(){
		const { axis } = this.props;
		const deltaScroll = this.scrollContainer[attributes.scroll[axis]] - this.initialScroll;

		const {
			prev,
			next
		} = this.dragBoundaries;

		let translate = this.dragLayer.translate[axis];

		if(this.host) translate += deltaScroll;

		if(typeof this.newIndex === `undefined`){
			this.newIndex = this.index;
		}

		// console.log(translate, prev, next, deltaScroll, this.host);
		if(prev && translate < prev){
			this.newIndex--;
			const nodes = this.manager.getOrderedRefs(); // TODO: Remove for performance
			const ref = nodes[this.newIndex];
			this.animateNode(ref ? ref.node : null);
			this.calculateDragBoundaries(this.index, this.newIndex, nodes);
		}else if(next && translate > next){
			this.newIndex++;
			const nodes = this.manager.getOrderedRefs(); // TODO: Remove for performance
			const ref = nodes[this.newIndex];
			this.animateNode(ref ? ref.node : null);
			this.calculateDragBoundaries(this.index, this.newIndex, nodes);
		}
	}

	autoscroll(){
		if(this.dragLayer.animating) return;

		const { axis } = this.props;
		let translate = this.dragLayer.translate[axis];
		let direction = 0;
		let speed = 1;
		let scroll = false;
		const scrollDirection = attributes.scroll[axis];
		const size = attributes.size[axis];

		if(!this.host){
			const deltaScroll = this.scrollContainer[scrollDirection] - this.initialScroll;
			translate -= deltaScroll;
		}

		if(translate >= this.dragLayer.maxTranslate){
			direction = 1; // Scroll Down/Right
			scroll = true;
			speed = acceleration * Math.abs((this.dragLayer.maxTranslate - translate) / this.dragLayer[size]);
		}else if(translate <= this.dragLayer.minTranslate){
			direction = -1; // Scroll Up/Left
			scroll = true;
			speed = acceleration * Math.abs((translate - this.dragLayer.minTranslate) / this.dragLayer[size]);
		}

		clearInterval(this.autoscrollInterval);

		if(!scroll) return;
		const offset = direction * speed;

		this.autoscrollInterval = setInterval(() => {
			const lastScroll = this.scrollContainer[scrollDirection];

			this.scrollContainer[scrollDirection] += offset;

			if(this.scrollContainer[scrollDirection] === lastScroll){
				clearInterval(this.autoscrollInterval);
			}

			this.dragLayer.updatePosition();
			this.animateNodes();
		}, 5);
	}

	getWrappedInstance(){
		invariant(
			this.props.config.withRef,
			`To access the wrapped instance, you need to pass in {withRef: true} as the second argument of the SortableContainer() call`,
		);
		return this.refs.wrappedInstance;
	}

	render(){
		const { component: Component, config } = this.props;

		const { transitionPrefix, transitionDuration } = this.dragLayer;

		const ref = config.withRef ? `wrappedInstance` : null;

		return <Component ref={ref} transitionName={transitionPrefix} transitionDuration={transitionDuration} {...omit(this.props, propKeys)} />;
	}
};