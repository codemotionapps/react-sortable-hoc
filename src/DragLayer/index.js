const {
	events,
	getOffset,
	getElementMargin
} = require(`../utils`);

const {
	closestRect,
	updateDistanceBetweenContainers,
	padding,
	getCoordinates
} = require(`./utils`);

module.exports = class {
	constructor(transitionPrefix, transitionDuration){
		this.helper = null;
		this.lists = [];
		this.listContainers = [];

		if(transitionPrefix){
			this.transitionPrefix = transitionPrefix;
			this.transitionDuration = transitionDuration;
			this.styleElement = document.createElement(`style`);
			this.styleElement.type = `text/css`;
			this.styleElement.build = function(height){
				this.innerText = `.${transitionPrefix}-leave, .${transitionPrefix}-enter.${transitionPrefix}-enter-active{height:${height}px;}`;
			};
		}

		this.events = {
			handleSortMove: this.handleSortMove.bind(this),
			handleSortEnd: this.handleSortEnd.bind(this)
		};
	}

	addRef(list){
		this.lists.push(list);
		return this.listContainers.push(undefined) - 1; // Filling a slot; returning index
	}

	removeRef(list){
		const i = this.lists.indexOf(list);
		if(i !== -1){
			this.lists.splice(i, 1);
			this.listContainers.splice(i, 1);
		}
	}

	setTranslateBoundaries(containerBoundingRect, list){
		const { useWindowAsScrollContainer } = list.props;

		this.minTranslate = {};
		this.maxTranslate = {};

		if(this.axis === `x`){
			let containerLeft;
			let containerWidth;

			if(useWindowAsScrollContainer){
				containerLeft = 0;
				containerWidth = list.contentWindow.innerWidth;
			}else{
				containerLeft = containerBoundingRect.left;
				containerWidth = containerLeft + containerBoundingRect.width;
			}

			const halfWidth = this.width / 2;
			this.minTranslate.x = containerLeft - this.boundingClientRect.left - halfWidth;
			this.maxTranslate.x = containerWidth - this.boundingClientRect.left - halfWidth;
		}else{
			let containerTop;
			let containerHeight;

			if(useWindowAsScrollContainer){
				containerTop = 0;
				containerHeight = list.contentWindow.innerHeight;
			}else{
				containerTop = containerBoundingRect.top;
				containerHeight = containerTop + containerBoundingRect.height;
			}

			const halfHeight = this.height / 2;
			this.minTranslate.y = containerTop - this.boundingClientRect.top - halfHeight;
			this.maxTranslate.y = containerHeight - this.boundingClientRect.top - halfHeight;
		}
	}

	startDrag(parent, list, e){
		const offset = getOffset(e);
		const activeNode = list.manager.getActive();

		if(!activeNode) return false;

		const {
			axis,
			getHelperDimensions
		} = list.props;
		const { node, collection } = activeNode;
		const { index } = node.sortableInfo;
		const margin = getElementMargin(node);
		const containerBoundingRect = list.container.getBoundingClientRect();
		const dimensions = getHelperDimensions({index, node, collection});

		this.width = dimensions.width;
		this.height = dimensions.height;
		this.marginOffset = {
			x: margin.left + margin.right,
			y: Math.max(margin.top, margin.bottom)
		};
		this.boundingClientRect = node.getBoundingClientRect();
		this.containerBoundingRect = containerBoundingRect;
		this.currentList = list;

		this.axis = axis;
		this.offsetEdge = list.getEdgeOffset(node);
		this.listInitialOffset = this.initialOffset = offset;
		this.distanceBetweenContainers = {
			x: 0,
			y: 0
		};

		const fields = node.querySelectorAll(`input, textarea, select`);
		const clonedNode = node.cloneNode(true);
		const clonedFields = [
			...clonedNode.querySelectorAll(`input, textarea, select`)
		]; // Convert NodeList to Array

		clonedFields.forEach((field, index) => {
			if(field.type !== `file` && fields[index]){
				field.value = fields[index].value;
			}
		});

		this.helper = parent.appendChild(clonedNode);

		this.helper.style.position = `fixed`;
		this.helper.style.top = `${this.boundingClientRect.top - margin.top}px`;
		this.helper.style.left = `${this.boundingClientRect.left -
			margin.left}px`;
		this.helper.style.width = `${this.width}px`;
		this.helper.style.height = `${this.height}px`;
		this.helper.style.boxSizing = `border-box`;
		this.helper.style.pointerEvents = `none`;

		list.host = true;

		list.calculateDragBoundaries(index);

		this.setTranslateBoundaries(containerBoundingRect, list);

		this.listenerNode = e.touches ? node : list.contentWindow;
		events.move.forEach(event => this.listenerNode.addEventListener(event, this.events.handleSortMove, false));
		events.end.forEach(event => this.listenerNode.addEventListener(event, this.events.handleSortEnd, false));

		document.head.appendChild(this.styleElement);
		const style = getComputedStyle(this.helper);
		this.styleElement.build(style.height - padding(style, axis));

		return activeNode;
	}

	stopDrag(){
		this.handleSortEnd();
	}

	handleSortMove(e){
		e.preventDefault(); // Prevent scrolling on mobile
		this.updatePosition(e);
		this.updateTargetContainer(e);
		if(this.currentList){
			this.currentList.handleSortMove(e);
		}
	}

	handleSortEnd(e){
		if(this.listenerNode){
			events.move.forEach(event => this.listenerNode.removeEventListener(event, this.events.handleSortMove));
			events.end.forEach(event => this.listenerNode.removeEventListener(event, this.events.handleSortEnd));
		}

		if(typeof this.onDragEnd === `function`){
			this.onDragEnd();
		}
		// Remove the helper from the DOM
		if(this.helper){
			this.helper.parentNode.removeChild(this.helper);
			this.helper = null;
			this.currentList.handleSortEnd(e);
		}

		if(this.styleElement){
			setTimeout(() => document.head.removeChild(this.styleElement));
		}
	}

	updatePosition(e){
		e ? this.lastMouseEvent = e : e = this.lastMouseEvent;

		const scrollOffset = {
			y: window.scrollY - this.currentList.initialWindowScroll.top,
			x: window.scrollX - this.currentList.initialWindowScroll.left
		};

		const offset = getOffset(e);
		const position = {
			x: offset.x - this.initialOffset.x - scrollOffset.x,
			y: offset.y - this.initialOffset.y - scrollOffset.y
		};

		this.helper.style[`transform`] = `translate3d(${position.x}px,${position.y}px,0px)`;

		let translate;
		if(this.listInitialOffset === this.initialOffset){
			translate = position;
		}else{
			const helperOffset = getCoordinates(this.helper, this.currentList);

			translate = { // TODO: Generate only axis
				x: helperOffset.x - this.listInitialOffset.x - scrollOffset.x,
				y: helperOffset.y - this.listInitialOffset.y - scrollOffset.y
			};
		}

		this.translate = translate;
		this.delta = offset;
	}

	updateTargetContainer(e){
		if(this.animating) return;

		const { pageX, pageY } = this.delta;
		const closest = this.lists[closestRect(pageX, pageY, this.listContainers)];
		const { item } = this.currentList.manager.active;
		this.active = item;

		if(closest === this.currentList) return;

		this.distanceBetweenContainers = updateDistanceBetweenContainers(
			this.distanceBetweenContainers,
			closest,
			this.currentList,
			{
				width: this.width,
				height: this.height
			},
		);
		this.currentList.handleSortEnd(e, closest);
		const list = closest;
		this.animating = true;

		setTimeout(() => {
			list.manager.active = {
				...list.getClosestNode(e),
				item
			};
			this.currentList = list;
			this.animating = false;
			this.setTranslateBoundaries(closest.container.getBoundingClientRect(), closest);
			list.calculateDragBoundaries(list.index);
			list.handlePress(e);
			const { offsetLeft, offsetTop } = list.sortableGhost;

			this.listInitialOffset = {
				x: offsetLeft,
				y: offsetTop
			};

			// this.updatePosition();
		}, this.transitionDuration);
	}
};