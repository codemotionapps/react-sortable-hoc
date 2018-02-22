const React = require(`react`);

function getNode(ref){
	ref && (ref.sortableHandle = true);
}

module.exports = function SortableHandle(props){
	const { component: Component, getComponentRef } = props;
	return <Component getNode={getNode} ref={getComponentRef} {...props} />;
};