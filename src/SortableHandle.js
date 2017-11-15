const React = require(`react`);

function getNode(ref){
	ref && (ref.sortableHandle = true);
}

module.exports = function(props){
	const { component: Component } = props;
	return <Component getNode={getNode} {...props} />;
};