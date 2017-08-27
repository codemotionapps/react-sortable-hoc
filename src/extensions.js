/* eslint eol-last: ["error", "always"] */

HTMLElement.prototype.isScrollable = function(){
	return this.offsetHeight !== this.scrollHeight;
};
