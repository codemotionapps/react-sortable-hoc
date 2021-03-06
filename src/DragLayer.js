import DropZone from './DropZone';
import {
	events,
	getOffset,
	getElementMargin,
	findClosestList,
	noop,
	getCoordinates
} from './utils';

export default class DragLayer {
	constructor(className, transitionDuration){
		this.helper = null;
		this.lists = [];

		if(className){
			this.transitionPrefix = className;
			this.transitionDuration = transitionDuration;

			this.stopAnimation = document.createElement(`style`);
			this.stopAnimation.type = `text/css`;
			this.stopAnimation.innerText = `.${className}{transition:none;}`;
		}

		this.events = {
			handleSortMove: this.handleSortMove.bind(this),
			handleSortEnd: this.handleSortEnd.bind(this)
		};
	}

	addRef(list){
		this.lists.push(list);
	}

	removeRef(list){
		const i = this.lists.indexOf(list);
		if(i !== -1){
			this.lists.splice(i, 1);
		}
	}

	setTranslateBoundaries(containerBoundingRect, rect){
		this.minTranslate = {};
		this.maxTranslate = {};

		/* eslint-disable no-var */
		if(this.axis === `x`){
			var rectAttr = `left`;
			var sizeAttr = `width`;
		}else{
			var rectAttr = `top`;
			var sizeAttr = `height`;
		}
		/* eslint-enable no-var */

		const containerTop = containerBoundingRect[rectAttr];
		const containerSize = containerTop + containerBoundingRect[sizeAttr];

		this.minTranslate = containerTop - rect[rectAttr];
		this.maxTranslate = containerSize - rect[rectAttr] - rect[sizeAttr];
	}

	startDrag(parent, list, e){
		const offset = getOffset(e);
		const node = list.manager.activeNode;

		if(!node) return false;

		const {
			axis,
			getHelperDimensions
		} = list.props;
		const { index } = node.sortableInfo;
		const margin = getElementMargin(node);
		const containerBoundingRect = list.scrollContainer.getBoundingClientRect();
		const dimensions = getHelperDimensions({index, node});

		this.width = dimensions.width;
		this.height = dimensions.height;
		this.marginOffset = {
			x: margin.left + margin.right,
			y: Math.max(margin.top, margin.bottom)
		};
		this.boundingClientRect = node.getBoundingClientRect();
		this.currentList = list;

		this.axis = axis;
		this.listInitialOffset = this.initialOffset = offset;

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
		// this.helper.style.pointerEvents = `none`;

		list.host = true;

		list.calculateDragBoundaries(index);

		this.setTranslateBoundaries(containerBoundingRect, this.boundingClientRect);

		this.listenerNode = e.touches ? node : list.contentWindow;
		events.move.forEach(event => this.listenerNode.addEventListener(event, this.events.handleSortMove, false));
		events.end.forEach(event => this.listenerNode.addEventListener(event, this.events.handleSortEnd, false));

		return node;
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
		if(this.stopAnimation){
			document.head.appendChild(this.stopAnimation);
			setTimeout(() => {
				if(this.stopAnimation.parentElement){
					document.head.removeChild(this.stopAnimation);
				}
			});
		}

		if(this.listenerNode){
			events.move.forEach(event => this.listenerNode.removeEventListener(event, this.events.handleSortMove));
			events.end.forEach(event => this.listenerNode.removeEventListener(event, this.events.handleSortEnd));
		}

		// Remove the helper from the DOM
		if(this.helper){
			this.helper.parentNode.removeChild(this.helper);
			this.helper = null;
			this.currentList.handleSortEnd(e);
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

		this.helper.style.transform = `translate3d(${position.x}px,${position.y}px,0px)`;

		/* eslint-disable no-var */
		if(this.listInitialOffset === this.initialOffset){
			var translate = position;
		}else{
			const { axis } = this;
			const helperOffset = getCoordinates(this.helper, this.currentList, axis);

			var translate = {};
			translate[axis] = helperOffset - this.listInitialOffset - scrollOffset[axis];
		}
		/* eslint-enable no-var */

		this.translate = translate;
		this.delta = offset;
	}

	updateTargetContainer(e){
		if(this.swapping) return;
		if(!this.helper) return;

		const { pageX, pageY } = this.delta;
		const closestList = findClosestList(pageX, pageY, this.lists);

		if(closestList === this.currentList) return;

		const isClosestListDropZone = closestList.constructor === DropZone;

		const { item } = this.currentList.manager.active;

		const index = !isClosestListDropZone
			? closestList.getClosestNode()
			: 0;
		closestList.manager.active = {
			index,
			item
		};

		this.currentList.handleSortEnd(e, closestList, index);

		closestList.index = index;

		if(isClosestListDropZone){
			this.currentList = closestList;
			closestList.handlePress(e);
			return;
		}

		this.swapping = true;
		closestList.manager.onInsert = (insertedIndex) => {
			if(index !== insertedIndex) return;

			delete this.swapping;
			closestList.manager.onInsert = noop;

			closestList.handlePress(e);
			closestList.calculateDragBoundaries(closestList.index);
			this.currentList = closestList;

			const rect = closestList.sortableGhost.ref.getBoundingClientRect();
			this.listInitialOffset = getCoordinates(rect, closestList, this.axis);
			this.setTranslateBoundaries(
				closestList.scrollContainer.getBoundingClientRect(),
				rect
			);
		};
	}
}