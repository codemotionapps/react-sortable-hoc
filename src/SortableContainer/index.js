const invariant = require(`invariant`);
const findIndex = require(`lodash.findindex`);
const PropTypes = require(`prop-types`);
const React = require(`react`);
const { Component } = React;
const { findDOMNode } = require(`react-dom`);

const DragLayer = require(`../DragLayer`);
const { closestRect } = require(`../DragLayer/utils`);

const Manager = require(`../Manager`);
const {
	closest,
	events,
	getOffset,
	dragComponentSize,
	cleanTranform,
	omit
} = require(`../utils`);

const propTypes = {
	axis: PropTypes.oneOf(['x', 'y']),
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
	hideSortableGhost: PropTypes.bool,
	lockOffset: PropTypes.oneOfType([
		PropTypes.number,
		PropTypes.string,
		PropTypes.arrayOf(
			PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
		)
	]),
	getContainer: PropTypes.func,
	getHelperDimensions: PropTypes.func
};

const propKeys = Object.keys(propTypes);

module.exports = class extends Component {
	constructor(props) {
		super(props);
		this.dragLayer = props.dragLayer || new DragLayer();
		this.dragLayer.addRef(this);
		this.dragLayer.onDragEnd = props.onDragEnd;
		this.manager = new Manager();
		this.events = {
			start: this.handleStart.bind(this),
			move: this.handleMove.bind(this),
			end: this.handleEnd.bind(this)
		};

		this.state = {};
	}

	static defaultProps = { // eslint-disable-line no-undef
		axis: 'y',
		config: {
			withRef: false
		},
		pressDelay: 0,
		pressThreshold: 5,
		useWindowAsScrollContainer: false,
		hideSortableGhost: true,
		contentWindow: typeof window !== 'undefined' ? window : null,
		shouldCancelStart(e){
			// Cancel sorting if the event target is an `input`, `textarea`, `select` or `option`
			const disabledElements = [
				'input',
				'textarea',
				'select',
				'option',
				'button'
			];

			if (disabledElements.indexOf(e.target.tagName.toLowerCase()) !== -1) {
				return true; // Return true to cancel sorting
			}
		},
		lockOffset: '50%',
		getHelperDimensions: ({node}) => ({
			width: node.offsetWidth,
			height: node.offsetHeight
		})
	};

	static propTypes = propTypes;

	static childContextTypes = { // eslint-disable-line no-undef
		manager: PropTypes.object.isRequired
	};

	getChildContext(){
		return {
			manager: this.manager
		};
	}

	componentDidMount(){
		const {
			contentWindow,
			getContainer,
			useWindowAsScrollContainer
		} = this.props;

		this.container = do{
			if(typeof getContainer === 'function'){
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

		this.initialScroll = {
			top: this.scrollContainer.scrollTop,
			left: this.scrollContainer.scrollLeft
		};
		this.contentWindow = do{
			if(typeof contentWindow === 'function'){
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
			const { index, collection } = node.sortableInfo;

			this.manager.active = {index, collection, item: items[index]};

			// Fixes a bug in Firefox where the :active state of anchor tags prevent subsequent 'mousemove' events from being fired (see https://github.com/clauderic/react-sortable-hoc/issues/118)
			if(e.target.tagName.toLowerCase() === 'a') e.preventDefault();

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

		if(!pressThreshold || pressThreshold && delta >= pressThreshold){
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
				axis,
				helperClass,
				hideSortableGhost,
				onSortStart
			} = this.props;
			const { node, collection } = activeNode;
			const { index } = node.sortableInfo;

			this.index = index;
			this.newIndex = index;

			this.initialScroll = {
				top: this.scrollContainer.scrollTop,
				left: this.scrollContainer.scrollLeft
			};

			this.initialWindowScroll = {
				top: window.scrollY,
				left: window.scrollX
			};

			if(hideSortableGhost){
				this.sortableGhost = node;
				node.style.visibility = 'hidden';
				node.style.transition = 'none';
				node.style.opacity = 0;
			}

			if(helperClass){
				this.dragLayer.helper.classList.add(...helperClass.split(' '));
			}

			this.setState({
				sorting: true,
				sortingIndex: index
			});

			if(onSortStart) onSortStart({node, index, collection}, e);
		}
	}

	handleSortMove(e){
		// animate nodes if required
		if(this.checkActive(e)){
			this.animateNodes();
			this.autoscroll();
		}
	}

	handleSortEnd(e, newList = null){
		const { hideSortableGhost, onSortEnd } = this.props;
		if(!this.manager.active){
			console.warn('there is no active node', e);
			return;
		}
		const { collection } = this.manager.active;

		if(hideSortableGhost && this.sortableGhost){
			this.sortableGhost.style.visibility = '';
			this.sortableGhost.style.opacity = '';
			this.sortableGhost.style.transition = '';
		}

		const nodes = this.manager.refs[collection];
		for(let i = 0, len = nodes.length; i < len; i++){
			const node = nodes[i];
			const el = node.node;

			// Clear the cached offsetTop / offsetLeft value
			node.edgeOffset = null;

			// Remove the transforms / transitions
			el.style.transform = '';
		}

		// Stop autoscroll
		clearInterval(this.autoscrollInterval);
		this.autoscrollInterval = null;

		// Update state
		this.manager.active = null;

		this.setState({
			sorting: false,
			sortingIndex: null
		});

		if(typeof onSortEnd === 'function'){
			// get the index in the new list
			if(newList){
				this.newIndex = newList.getClosestNode(e).index;
			}

			onSortEnd({
				oldIndex: this.index,
				newIndex: this.newIndex,
				newList,
				collection
			}, e);
		}

		this._touched = false;
	}

	handleSortSwap(index, item){
		const { onSortSwap } = this.props;
		if(typeof onSortSwap === 'function'){
			onSortSwap({
				index,
				item
			});
		}
	}

	getEdgeOffset(node, offset = {top: 0, left: 0}){
		// Get the actual offsetTop / offsetLeft value, no matter how deep the node is nested
		if (node) {
			const nodeOffset = {
				top: offset.top + node.offsetTop,
				left: offset.left + node.offsetLeft
			};
			if (node.parentNode !== this.container) {
				return this.getEdgeOffset(node.parentNode, nodeOffset);
			} else {
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

		invariant(lockOffset.length === 2, 'lockOffset prop of SortableContainer should be a single value or an array of exactly two values. Given %s', lockOffset);

		const [ minLockOffset, maxLockOffset ] = lockOffset;

		return [
			this.getLockPixelOffset(minLockOffset),
			this.getLockPixelOffset(maxLockOffset)
		];
	}

	getLockPixelOffset(lockOffset){
		let offsetX = lockOffset;
		let offsetY = lockOffset;
		let unit = 'px';

		if(typeof lockOffset === 'string'){
			const match = /^[+-]?\d*(?:\.\d*)?(px|%)$/.exec(lockOffset);

			invariant(
				match !== null,
				'lockOffset value should be a number or a string of a ' +
					'number followed by "px" or "%". Given %s',
				lockOffset,
			);

			offsetX = offsetY = parseFloat(lockOffset);
			unit = match[1];
		}

		invariant(isFinite(offsetX) && isFinite(offsetY), 'lockOffset value should be a finite. Given %s', lockOffset);

		if(unit === '%'){
			offsetX = offsetX * this.dragLayer.width / 100;
			offsetY = offsetY * this.dragLayer.height / 100;
		}

		return {
			x: offsetX,
			y: offsetY
		};
	}

	getClosestNode(e){
		const p = getOffset(e);
		const closestNodes = [];
		const closestCollections = [];
		//TODO: keys is converting number to string!!! check origin value type as number???
		Object.keys(this.manager.refs).forEach(collection => {
			const nodes = this.manager.refs[collection].map(n => n.node);
			if (nodes && nodes.length > 0) {
				closestNodes.push(nodes[closestRect(p.x, p.y, nodes)]);
				closestCollections.push(collection);
			}
		});
		const index = closestRect(p.x, p.y, closestNodes);
		const collection = closestCollections[index];
		if(collection === undefined){
			return {
				collection,
				index: 0
			};
		}
		const finalNodes = this.manager.refs[collection].map(n => n.node);
		const finalIndex = finalNodes.indexOf(closestNodes[index]);
		const node = closestNodes[index];
		//TODO: add better support for grid
		const rect = node.getBoundingClientRect();
		return {
			collection,
			index: finalIndex + (p.y > rect.bottom ? 1 : 0)
		};
	}

	checkActive(e){
		const active = this.manager.active;
		if(!active){
			// find closest collection
			const node = closest(e.target, el => Boolean(el.sortableInfo));
			if(node && node.sortableInfo){
				const p = getOffset(e);
				const {collection} = node.sortableInfo;
				const nodes = this.manager.refs[collection].map(n => n.node);
				// find closest index in collection
				if(nodes){
					const index = closestRect(p.x, p.y, nodes);
					this.manager.active = {
						index,
						collection,
						item: this.props.items[index]
					};
					this.handlePress(e);
				}
			}

			return false;
		}

		return true;
	}

	calculateReturningBoundary(boundary, name, substract, oldBoundaries){
		const { bound } = boundary;
		const boundLast = `${bound}last`;

		if(oldBoundaries[bound]){
			const sizes = this.dragBoundaries[`${name}Sizes`];
			const nodes = this.dragBoundaries[`${name}Nodes`];

			const returningNode = nodes.pop();
			returningNode.style.transform = "";

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
			console.log(halfs, lastSize, size);
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
				bound: "prev",
				next: -1
			};
			const below = {
				node: nextNode,
				bound: "next",
				next: 1
			};

			if(!shouldPop){ // Add nodes
				this.calculateBoundary(above, "above", axis, marginOffset, isMovingUp, oldDragBoundaries);
				this.calculateBoundary(below, "below", axis, marginOffset, !isMovingUp, oldDragBoundaries);
			}else{ // Remove nodes
				this.calculateReturningBoundary(above, "above", isMovingUp, oldDragBoundaries);
				this.calculateReturningBoundary(below, "below", !isMovingUp, oldDragBoundaries);
			}
		}

		console.log(this.dragBoundaries);
	}

	animateNode(node){
		const axis = this.props.axis.toUpperCase();
		const size = do{
			if(axis === "X") this.dragLayer.width + this.dragLayer.marginOffset.x;
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
		const { hideSortableGhost } = this.props;
		const nodes = this.manager.getOrderedRefs();
		const deltaScroll = {
			left: this.scrollContainer.scrollLeft - this.initialScroll.left,
			top: this.scrollContainer.scrollTop - this.initialScroll.top
		};

		const sortingOffset = {
			left: this.dragLayer.offsetEdge.left - this.dragLayer.distanceBetweenContainers.x + this.dragLayer.translate.x + deltaScroll.left,
			top: this.dragLayer.offsetEdge.top - this.dragLayer.distanceBetweenContainers.y + this.dragLayer.translate.y + deltaScroll.top
		};

		const scrollDifference = {
			top: (window.scrollY - this.initialWindowScroll.top),
			left: (window.scrollX - this.initialWindowScroll.left)
		};

		const {
			prev,
			next
		} = this.dragBoundaries;

		const translate = this.dragLayer.translate[this.props.axis];

		if(typeof this.newIndex === "undefined"){
			this.newIndex = this.index;
		}

		console.log(translate, prev, next, translate < prev, translate > next);
		if(prev && translate < prev){
			this.newIndex--;
			this.animateNode(nodes[this.newIndex].node);
			this.calculateDragBoundaries(this.index, this.newIndex, nodes);
		}else if(next && translate > next){
			this.newIndex++;
			this.animateNode(nodes[this.newIndex].node);
			this.calculateDragBoundaries(this.index, this.newIndex, nodes);
		}

		/*		for(const i in nodes){
			if(!nodes.hasOwnProperty(i)) continue;

			const { node } = nodes[i];
			const { index } = node.sortableInfo;
			const width = node.offsetWidth;
			const height = node.offsetHeight;
			const offset = {
				width: do{
					if(this.dragLayer.width > width){
						width / 2;
					}else{
						this.dragLayer.width / 2;
					}
				},
				height: do{
					if(this.dragLayer.height > height){
						height / 2;
					}else{
						this.dragLayer.height / 2;
					}
				}
			};

			const translate = {
				x: 0,
				y: 0
			};
			let { edgeOffset } = nodes[i];

			// If we haven't cached the node's offsetTop / offsetLeft value
			if(!edgeOffset){
				nodes[i].edgeOffset = edgeOffset = this.getEdgeOffset(node);
			}

			// If the node is the one we're currently animating, skip it
			if(index === this.index){
				if(hideSortableGhost){
					// With windowing libraries such as `react-virtualized`, the sortableGhost node may change while scrolling down and then back up (or vice-versa), so we need to update the reference to the new node just to be safe.
					this.sortableGhost = node;
					node.style.visibility = 'hidden';
					node.style.transition = 'none';
					node.style.opacity = 0;
				}

				continue;
			}

			if(this.axis.x){
				if(index > this.index && (sortingOffset.left + scrollDifference.left) + offset.width >= edgeOffset.left){
					translate.x = -(this.dragLayer.width + this.dragLayer.marginOffset.x);
					this.newIndex = index;
				}else if(index < this.index && (sortingOffset.left + scrollDifference.left) <= edgeOffset.left + offset.width){
					translate.x = this.dragLayer.width + this.dragLayer.marginOffset.x;

					if(!this.newIndex){
						this.newIndex = index;
					}
				}
			}else if(this.axis.y){
				if(index > this.index && (sortingOffset.top + scrollDifference.top) + offset.height >= edgeOffset.top){
					translate.y = -(this.dragLayer.height + this.dragLayer.marginOffset.y);
					this.newIndex = index;
				}else if(index < this.index && (sortingOffset.top + scrollDifference.top) <= edgeOffset.top + offset.height){
					translate.y = this.dragLayer.height + this.dragLayer.marginOffset.y;

					if(!this.newIndex){
						this.newIndex = index;
					}
				}
			}
			node.style[`transform`] = `translate3d(${translate.x}px,${translate.y}px,0px)`;
		}*/
	}

	autoscroll(){
		const translate = this.dragLayer.translate;
		const direction = {
			x: 0,
			y: 0
		};
		const speed = {
			x: 1,
			y: 1
		};
		const acceleration = {
			x: 10,
			y: 10
		};

		if(translate.y >= this.dragLayer.maxTranslate.y - this.dragLayer.height / 2){
			direction.y = 1; // Scroll Down
			speed.y = acceleration.y * Math.abs((this.dragLayer.maxTranslate.y - this.dragLayer.height / 2 - translate.y) / this.dragLayer.height);
		}else if(translate.x >= this.dragLayer.maxTranslate.x - this.dragLayer.width / 2){
			direction.x = 1; // Scroll Right
			speed.x = acceleration.x * Math.abs((this.dragLayer.maxTranslate.x - this.dragLayer.width / 2 - translate.x) / this.dragLayer.width);
		}else if(translate.y <= this.dragLayer.minTranslate.y + this.dragLayer.height / 2){
			direction.y = -1; // Scroll Up
			speed.y = acceleration.y * Math.abs((translate.y - this.dragLayer.height / 2 - this.dragLayer.minTranslate.y) / this.dragLayer.height);
		}else if(translate.x <= this.dragLayer.minTranslate.x + this.dragLayer.width / 2){
			direction.x = -1; // Scroll Left
			speed.x = acceleration.x * Math.abs((translate.x - this.dragLayer.width / 2 - this.dragLayer.minTranslate.x) / this.dragLayer.width);
		}

		if(this.autoscrollInterval){
			clearInterval(this.autoscrollInterval);
			this.autoscrollInterval = null;
			this.isAutoScrolling = false;
		}

		if(direction.x !== 0 || direction.y !== 0){
			this.autoscrollInterval = setInterval(() => {
				this.isAutoScrolling = true;
				const offset = {
					left: 1 * speed.x * direction.x,
					top: 1 * speed.y * direction.y
				};
				this.scrollContainer.scrollTop += offset.top;
				this.scrollContainer.scrollLeft += offset.left;
				// this.dragLayer.translate.x += offset.left;
				// this.dragLayer.translate.y += offset.top;
				this.animateNodes();
			}, 5);
		}
	}

	getWrappedInstance(){
		invariant(
			this.props.config.withRef,
			'To access the wrapped instance, you need to pass in {withRef: true} as the second argument of the SortableContainer() call',
		);
		return this.refs.wrappedInstance;
	}

	render(){
		const { component: Component, config } = this.props;

		const ref = config.withRef ? 'wrappedInstance' : null;

		return <Component ref={ref} {...omit(this.props, propKeys)} />;
	}
};