const invariant = require(`invariant`);
const PropTypes = require(`prop-types`);
const React = require(`react`);
const { Component } = React;

const DragLayer = require(`./DragLayer`);

const Manager = require(`./Manager`);
const {
	closest,
	events,
	getOffset,
	closestNode,
	getHelperBoundaries,
	dragComponentSize,
	cleanTransform,
	noop,
	isScrollable,
	arrayLast,
	attributes,
	omit
} = require(`./utils`);

const propTypes = {
	axis: PropTypes.oneOf([`x`, `y`]),
	domRef: PropTypes.func,
	component: PropTypes.oneOfType([PropTypes.func, PropTypes.string]).isRequired,
	items: PropTypes.array.isRequired,
	dragLayer: PropTypes.object,
	disabled: PropTypes.bool,
	helperClass: PropTypes.string,
	contentWindow: PropTypes.any,
	onSortStart: PropTypes.func.isRequired,
	onSortEnd: PropTypes.func.isRequired,
	onSortSwap: PropTypes.func,
	shouldCancelStart: PropTypes.func,
	distance: PropTypes.number,
	useDragHandle: PropTypes.bool,
	scrollContainer: PropTypes.object,
	childSetDraggable: PropTypes.bool,
	lockOffset: PropTypes.oneOfType([
		PropTypes.number,
		PropTypes.string,
		PropTypes.arrayOf(PropTypes.oneOfType([PropTypes.number, PropTypes.string]))
	]),
	transitionPrefix: PropTypes.string,
	getHelperDimensions: PropTypes.func
};

const acceleration = 10;

const propKeys = Object.keys(propTypes);

module.exports = class SortableContainer extends Component {
	constructor(props){
		super(props);
		this.dragLayer = props.dragLayer || new DragLayer();
		this.indexInLayer = this.dragLayer.addRef(this);
		this.manager = new Manager(this);
		this.host = false;
		this.events = {
			start: this.handleStart.bind(this),
			move: this.handleMove.bind(this),
			end: this.handleEnd.bind(this)
		};
	}

	getRef = ::this.getRef;
	getRef(ref){
		this.container = ref;
		const { domRef } = this.props;
		domRef && domRef(ref);
	}

	static defaultProps = {
		axis: `y`,
		distance: 0,
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
		onSortSwap: noop,
		childSetDraggable: false,
		lockOffset: `50%`,
		getHelperDimensions: ({node}) => ({
			width: node.offsetWidth,
			height: node.offsetHeight
		})
	};

	static propTypes = propTypes;

	static childContextTypes = {
		manager: PropTypes.object.isRequired,
		childSetDraggable: PropTypes.bool
	};

	getChildContext(){
		return {
			manager: this.manager,
			childSetDraggable: this.props.childSetDraggable
		};
	}

	setInitialScroll(axis){
		this.initialScroll = this.scrollContainer[attributes.scroll[axis]];
	}

	componentDidMount(){
		const {
			contentWindow,
			scrollContainer,
			axis
		} = this.props;

		this.dragLayer.listContainers[this.indexInLayer] = this.container;

		this.document = this.container.ownerDocument || document;

		this.scrollContainer = scrollContainer || this.container;

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
		const newIndex = items.indexOf(item);
		if(newIndex === -1){
			this.dragLayer.stopDrag();
			return;
		}
		this.manager.active.index = newIndex;
		this.index = newIndex;
	}

	handleStart(e){
		if(this.props.disabled) return;

		const p = getOffset(e);
		const { shouldCancelStart, items, distance } = this.props;

		if(e.button === 2 || shouldCancelStart(e)){
			return false;
		}

		this._touched = true;
		this._pos = p;

		const node = closest(e.target, el => Boolean(el.sortableInfo));

		if(node && node.sortableInfo && this.nodeIsChild(node) && !this.sorting){
			const { useDragHandle } = this.props;
			if(useDragHandle && !closest(e.target, el => Boolean(el.sortableHandle))) return;

			const { index } = node.sortableInfo;

			this.manager.active = {index, item: items[index]};

			// Fixes a bug in Firefox where the :active state of anchor tags prevent subsequent 'mousemove' events from being fired (see https://github.com/clauderic/react-sortable-hoc/issues/118)
			if(e.target.tagName.toLowerCase() === `a`) e.preventDefault();

			if(!distance) this.handlePress(e);
		}
	}

	nodeIsChild(node){
		return node.sortableInfo.manager === this.manager;
	}

	handleMove(e){
		const { distance } = this.props;
		const p = getOffset(e);

		if(this.sorting || !this._touched) return;

		this._delta = {
			x: this._pos.x - p.x,
			y: this._pos.y - p.y
		};
		const delta = Math.abs(this._delta.x) + Math.abs(this._delta.y);

		if(!distance){
			clearTimeout(this.cancelTimer);
			this.cancelTimer = setTimeout(this.cancel);
		}else if(distance && delta >= distance && this.manager.isActive){
			this.handlePress(e);
		}
	}

	handleEnd(){
		this._touched = false;

		this.cancel();
	}

	cancel(){
		if(this.sorting) return;

		clearTimeout(this.pressTimer);
		if(this.manager) this.manager.active = null;
	}

	handlePress(e){
		this.isScrollable = isScrollable(this.scrollContainer);
		let node = null;
		if(this.dragLayer.helper){
			if(this.manager.active){
				this.checkActiveIndex();
				node = this.manager.activeNode;
			}
		}else{
			node = this.dragLayer.startDrag(this.document.body, this, e);
		}

		this.initialWindowScroll = {
			top: window.scrollY,
			left: window.scrollX
		};

		if(!node) return;

		const {
			helperClass,
			onSortStart,
			axis
		} = this.props;
		const { index } = node.sortableInfo;

		this.index = index;
		this.newIndex = index;

		this.setInitialScroll(axis);

		this.sortableGhost = node.sortableInfo;

		if(helperClass) this.dragLayer.helper.classList.add(helperClass);

		this.sorting = true;

		if(onSortStart) onSortStart({node, index});
	}

	handleSortMove(e){
		if(!this.dragLayer.swapping && this.checkActive(e)){
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

		const nodes = this.manager.nodes;
		for(const i in nodes){
			const node = nodes[i];

			// Remove the transforms
			node.style.transform = ``;
		}

		// Stop autoscroll
		clearInterval(this.autoscrollInterval);

		// Update state
		this.manager.active = null;

		this.sorting = false;

		if(newList){
			this.newIndex = newIndex;
		}

		onSortEnd({
			oldIndex: this.index,
			newIndex: this.newIndex,
			newList
		}, e);

		this._touched = false;
	}

	handleSortSwap(index, item){
		const { onSortSwap } = this.props;
		onSortSwap({
			index,
			item
		});
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

		const [minLockOffset, maxLockOffset] = lockOffset;

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

		const nodes = this.manager.nodes;

		if(nodes && nodes.length > 0){
			const closest = closestNode(coordinates, nodes, axis);

			let { index } = closest;
			const { node } = closest;

			const sizeAttr = attributes.size[axis];
			const cAttr = attributes.coordinate[axis];

			const rect = node.getBoundingClientRect();
			const boundary = rect[cAttr] + (rect[sizeAttr] / 2);

			if(nodes.length > index && coordinates[1] > boundary) index++;
			// if(index > 0 && coordinates[0] < boundary) index--;

			return index;
		}

		return 0;
	}

	checkActive(e){
		const { active } = this.manager;
		if(active) return true;

		const node = closest(e.target, el => Boolean(el.sortableInfo));
		if(node && node.sortableInfo){
			const nodes = this.manager.nodes;

			if(nodes){
				const { helper } = this.dragLayer;
				const { axis } = this.props;

				const coordinates = getHelperBoundaries(helper, axis);
				const { index } = closestNode(coordinates, nodes, axis);
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

			const returningNode = this.manager.nodes[nodes.pop().index];
			returningNode.style.transform = ``;

			let halfs = sizes.pop() + arrayLast(sizes);
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
			const lastSize = arrayLast(sizes);

			const size = dragComponentSize(node, axis, marginOffset, next);
			sizes.push(size);
			nodes.push(node.sortableInfo);

			let halfs = (lastSize || 0) + size;
			if(!substract) halfs = -halfs;

			this.dragBoundaries[bound] = (oldBoundaries[bound] || 0) + halfs;
		}else{
			const boundLast = `${bound}last`;
			this.dragBoundaries[boundLast] = oldBoundaries[bound];
		}
	}

	calculateDragBoundaries(index, newIndex = index){
		const { nodes } = this.manager;
		const { axis } = this.props;
		const marginOffset = this.dragLayer.marginOffset[axis];

		const oldDragBoundaries = this.dragBoundaries || {};
		this.dragBoundaries = {};
		const differnece = index - newIndex;

		let prevIndex = index - differnece;
		if(differnece >= 0) prevIndex--;
		const prevNode = nodes[prevIndex];

		let nextIndex = index - differnece;
		if(differnece <= 0) nextIndex++;
		const nextNode = nodes[nextIndex];

		this.dragBoundaries.differnece = differnece;

		this.dragBoundaries.aboveNodes = oldDragBoundaries.aboveNodes;
		this.dragBoundaries.aboveSizes = oldDragBoundaries.aboveSizes;

		this.dragBoundaries.belowNodes = oldDragBoundaries.belowNodes;
		this.dragBoundaries.belowSizes = oldDragBoundaries.belowSizes;

		if(differnece === 0){
			cleanTransform(oldDragBoundaries.aboveNodes, nodes);
			cleanTransform(oldDragBoundaries.belowNodes, nodes);

			const aboveNodes = [];
			const aboveSizes = [];

			const belowNodes = [];
			const belowSizes = [];

			if(prevNode){
				const size = dragComponentSize(prevNode, axis, marginOffset, -1);
				this.dragBoundaries.prev = size;
				aboveNodes.push(prevNode.sortableInfo);
				aboveSizes.push(size);
			}

			if(nextNode){
				const size = dragComponentSize(nextNode, axis, marginOffset, 1);
				this.dragBoundaries.next = size;
				belowNodes.push(nextNode.sortableInfo);
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

			if(shouldPop){ // Remove nodes
				this.calculateReturningBoundary(above, `above`, isMovingUp, oldDragBoundaries);
				this.calculateReturningBoundary(below, `below`, !isMovingUp, oldDragBoundaries);
			}else{ // Add nodes
				this.calculateBoundary(above, `above`, axis, marginOffset, isMovingUp, oldDragBoundaries);
				this.calculateBoundary(below, `below`, axis, marginOffset, !isMovingUp, oldDragBoundaries);
			}
		}
	}

	animateNode(node: HTMLElement){
		if(!node) return;

		const axis = this.props.axis.toUpperCase();
		const size = do{
			if(axis === `X`) this.dragLayer.width + this.dragLayer.marginOffset.x;
			else this.dragLayer.height + this.dragLayer.marginOffset.y;
		};

		if(this.index > this.newIndex){ // prev
			node.style.transform = `translate${axis}(${size}px)`;
		}else if(this.index < this.newIndex){ // next
			node.style.transform = `translate${axis}(${-size}px)`;
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

		if(prev && translate < prev){
			this.newIndex--;
			const node = this.manager.nodes[this.newIndex];
			this.animateNode(node);
			this.calculateDragBoundaries(this.index, this.newIndex);
		}else if(next && translate > next){
			this.newIndex++;
			const node = this.manager.nodes[this.newIndex];
			this.animateNode(node);
			this.calculateDragBoundaries(this.index, this.newIndex);
		}
	}

	autoscroll(){
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

		const { maxTranslate, minTranslate } = this.dragLayer;
		if(translate >= maxTranslate){
			direction = 1; // Scroll Down/Right
			scroll = true;
			speed = acceleration * Math.abs((maxTranslate - translate) / this.dragLayer[size]);
		}else if(translate <= this.dragLayer.minTranslate){
			direction = -1; // Scroll Up/Left
			scroll = true;
			speed = acceleration * Math.abs((translate - minTranslate) / this.dragLayer[size]);
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

	render(){
		const { component: Component, items } = this.props;

		const props = omit(this.props, propKeys);

		const { transitionPrefix, transitionDuration } = this.dragLayer;

		if(typeof Component === `string`){
			props.ref = this.getRef;
		}else{
			props.transitionName = transitionPrefix;
			props.transitionDuration = transitionDuration;
			props.items = items;
			props.getRef = this.getRef;
		}

		return <Component {...props} />;
	}
};