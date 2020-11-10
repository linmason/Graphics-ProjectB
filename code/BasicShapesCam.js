//3456789_123456789_123456789_123456789_123456789_123456789_123456789_123456789_
// (JT: why the numbers? counts columns, helps me keep 80-char-wide listings)
//
// Chapter 5: ColoredTriangle.js (c) 2012 matsuda  AND
// Chapter 4: RotatingTriangle_withButtons.js (c) 2012 matsuda
// became:
//
// BasicShapes.js  MODIFIED for EECS 351-1, 
//									Northwestern Univ. Jack Tumblin
//		--converted from 2D to 4D (x,y,z,w) vertices
//		--extend to other attributes: color, surface normal, etc.
//		--demonstrate how to keep & use MULTIPLE colored shapes in just one
//			Vertex Buffer Object(VBO). 
//		--create several canonical 3D shapes borrowed from 'GLUT' library:
//		--Demonstrate how to make a 'stepped spiral' tri-strip,  and use it
//			to build a cylinder, sphere, and torus.


// Vertex shader program----------------------------------
var VSHADER_SOURCE = 
  'uniform mat4 u_ModelMatrix;\n' +
  'attribute vec4 a_Position;\n' +
  'attribute vec4 a_Color;\n' +
  'varying vec4 v_Color;\n' +
  'void main() {\n' +
  '  gl_Position = u_ModelMatrix * a_Position;\n' +
  '  gl_PointSize = 10.0;\n' +
  '  v_Color = a_Color;\n' +
  '}\n';

// Fragment shader program----------------------------------
var FSHADER_SOURCE = 
//  '#ifdef GL_ES\n' +
  'precision mediump float;\n' +
//  '#endif GL_ES\n' +
  'varying vec4 v_Color;\n' +
  'void main() {\n' +
  '  gl_FragColor = v_Color;\n' +
  '}\n';

// Global Variables
var g_canvas = document.getElementById('webgl');  // Retrieve HTML <canvas> element
var g_strafeTranslate = 0;
var g_lookatTranslate = 0;
var g_theta = 0;
var g_thetaRate = 0;
var g_zOffset = 0;
var g_zOffsetRate = 0;

var ANGLE_STEP = 45.0;		// Rotation angle rate (degrees/second)
var floatsPerVertex = 7;	// # of Float32Array elements used for each vertex
													// (x,y,z,w)position + (r,g,b)color
													// Later, see if you can add:
													// (x,y,z) surface normal + (tx,ty) texture addr.
var g_angle01 = 0;
var g_angle01Rate = 100;
var g_angle01min = -180;
var g_angle01max = 180;

var g_angle02 = 0;
var g_angle02Rate = 50;
var g_angle02min = -90;
var g_angle02max = 90;

var g_angle03 = 0;
var g_angle03Rate = 75;
var g_angle03min = -60;
var g_angle03max = 60;

//------------For mouse click-and-drag: -------------------------------
var isDrag=false;		// mouse-drag: true when user holds down mouse button
var xMclik=0.0;			// last mouse button-down position (in CVV coords)
var yMclik=0.0;   
var xMdragTot=0.0;	// total (accumulated) mouse-drag amounts (in CVV coords).
var yMdragTot=0.0;  

var qNew = new Quaternion(0,0,0,1);			// most-recent mouse drag's rotation
var qTot = new Quaternion(0,0,0,1);			// 'current' orientation (made from qNew)
var quatMatrix = new Matrix4();				// rotation matrix, made from latest qTot



function main() {
//==============================================================================
	// Retrieve <canvas> element
	var canvas = document.getElementById('webgl');

	// Get the rendering context for WebGL
	var gl = getWebGLContext(canvas);
	if (!gl) {
	console.log('Failed to get the rendering context for WebGL');
	return;
	}

	// Initialize shaders
	if (!initShaders(gl, VSHADER_SOURCE, FSHADER_SOURCE)) {
	console.log('Failed to intialize shaders.');
	return;
	}

	//  Initialize vertex buffer
	var n = initVertexBuffer(gl);
	if (n < 0) {
		console.log('Failed to set the vertex information');
		return;
	}

	// add event listeners
	window.addEventListener("keydown", myKeyDown, false);
	window.addEventListener("keyup", myKeyUp, false);

	canvas.onmousedown	=	function(ev){myMouseDown( ev, gl, canvas) }; 
  					// when user's mouse button goes down, call mouseDown() function
    canvas.onmousemove = 	function(ev){myMouseMove( ev, gl, canvas) };
											// when the mouse moves, call mouseMove() function					
    canvas.onmouseup = 		function(ev){myMouseUp(   ev, gl, canvas)};


	// Specify the color for clearing <canvas>
	gl.clearColor(0.0, 0.0, 0.0, 1.0);

	// Enable 3D depth-test when drawing: don't over-draw at any pixel 
	// unless the new Z value is closer to the eye than the old one..
	gl.enable(gl.DEPTH_TEST); 	 

	// Get handle to graphics system's storage location of u_ModelMatrix
	var u_ModelMatrix = gl.getUniformLocation(gl.program, 'u_ModelMatrix');
	if (!u_ModelMatrix) { 
		console.log('Failed to get the storage location of u_ModelMatrix');
		return;
	}

	// Create a local version of our model matrix in JavaScript 
	var modelMatrix = new Matrix4();
	

	// Create, init current rotation angle value in JavaScript
	var currentAngle = 0.0;

	// Initialize eye position
	var eye_position = [1, 0, 1];

	// Initialize look at position
	var lookat_position = [1, 1, 1];

	// Start drawing: create 'tick' variable whose value is this function:
	var tick = function() {
		// get lookat and eye positions
		updateCameraPositions(eye_position, lookat_position);
		currentAngle = animate(currentAngle);  // Update the rotation angle
		drawAll(gl, n, currentAngle, modelMatrix, u_ModelMatrix, eye_position, lookat_position);   // Draw shapes
		// report current angle on console
		//console.log('currentAngle=',currentAngle);
		requestAnimationFrame(tick, canvas);  // Request that the browser re-draw the webpage
	};

	// Resize the image on load
	resizeCanvas();

	// Start (and continue) animation: draw current image
	tick();
}

function initVertexBuffer(gl) {
//==============================================================================
// Create one giant vertex buffer object (VBO) that holds all vertices for all
// shapes.
 
 	// Make each 3D shape in its own array of vertices:
	makeCylinder();					// create, fill the cylVerts array
	makeSphere();						// create, fill the sphVerts array
	makeTorus();						// create, fill the torVerts array
	makeGroundGrid();				// create, fill the gndVerts array
	makeHouse();
	makeDiamond();
	makePyramid();
	makeAxes();
	  
	// how many floats total needed to store all shapes?
	var mySiz = (cylVerts.length + sphVerts.length + 
							 torVerts.length + gndVerts.length + houseVerts.length + diamondVerts.length
							 + pyramidVerts.length + axesVerts.length);						

	// How many vertices total?
	var nn = mySiz / floatsPerVertex;
	console.log('nn is', nn, 'mySiz is', mySiz, 'floatsPerVertex is', floatsPerVertex);
	// Copy all shapes into one big Float32 array:
  	var colorShapes = new Float32Array(mySiz);
	// Copy them:  remember where to start for each shape:
	cylStart = 0;							// we stored the cylinder first.
  	for(i=0,j=0; j< cylVerts.length; i++,j++) {
  		colorShapes[i] = cylVerts[j];
		}
	
	sphStart = i;						// next, we'll store the sphere;
	for(j=0; j< sphVerts.length; i++, j++) {// don't initialize i -- reuse it!
		colorShapes[i] = sphVerts[j];
		}
	
	torStart = i;						// next, we'll store the torus;
	for(j=0; j< torVerts.length; i++, j++) {
		colorShapes[i] = torVerts[j];
		}
	
	gndStart = i;						// next we'll store the ground-plane;
	for(j=0; j< gndVerts.length; i++, j++) {
		colorShapes[i] = gndVerts[j];
		}

	houseStart = i;						// next we'll store the ground-plane;
	for(j=0; j< houseVerts.length; i++, j++) {
		colorShapes[i] = houseVerts[j];
		}

	diamondStart = i;						// next we'll store the ground-plane;
	for(j=0; j< diamondVerts.length; i++, j++) {
		colorShapes[i] = diamondVerts[j];
		}

	pyramidStart = i;						// next we'll store the ground-plane;
	for(j=0; j< pyramidVerts.length; i++, j++) {
		colorShapes[i] = pyramidVerts[j];
		}
		
	axesStart = i;						// next we'll store the ground-plane;
	for(j=0; j< axesVerts.length; i++, j++) {
		colorShapes[i] = axesVerts[j];
		}


	// Create a buffer object on the graphics hardware:
	var shapeBufferHandle = gl.createBuffer();  
	if (!shapeBufferHandle) {
		console.log('Failed to create the shape buffer object');
		return false;
	}

	// Bind the the buffer object to target:
	gl.bindBuffer(gl.ARRAY_BUFFER, shapeBufferHandle);
	// Transfer data from Javascript array colorShapes to Graphics system VBO
	// (Use sparingly--may be slow if you transfer large shapes stored in files)
	gl.bufferData(gl.ARRAY_BUFFER, colorShapes, gl.STATIC_DRAW);
    
	//Get graphics system's handle for our Vertex Shader's position-input variable: 
	var a_Position = gl.getAttribLocation(gl.program, 'a_Position');
	if (a_Position < 0) {
		console.log('Failed to get the storage location of a_Position');
		return -1;
	}

	var FSIZE = colorShapes.BYTES_PER_ELEMENT; // how many bytes per stored value?

	// Use handle to specify how to retrieve **POSITION** data from our VBO:
	gl.vertexAttribPointer(
			a_Position, 	// choose Vertex Shader attribute to fill with data
			4, 						// how many values? 1,2,3 or 4.  (we're using x,y,z,w)
			gl.FLOAT, 		// data type for each value: usually gl.FLOAT
			false, 				// did we supply fixed-point data AND it needs normalizing?
			FSIZE * floatsPerVertex, // Stride -- how many bytes used to store each vertex?
										// (x,y,z,w, r,g,b) * bytes/value
			0);						// Offset -- now many bytes from START of buffer to the
										// value we will actually use?
	gl.enableVertexAttribArray(a_Position);  
  									// Enable assignment of vertex buffer object's position data

	// Get graphics system's handle for our Vertex Shader's color-input variable;
	var a_Color = gl.getAttribLocation(gl.program, 'a_Color');
	if(a_Color < 0) {
		console.log('Failed to get the storage location of a_Color');
		return -1;
	}
	// Use handle to specify how to retrieve **COLOR** data from our VBO:
	gl.vertexAttribPointer(
		a_Color, 				// choose Vertex Shader attribute to fill with data
		3, 							// how many values? 1,2,3 or 4. (we're using R,G,B)
		gl.FLOAT, 			// data type for each value: usually gl.FLOAT
		false, 					// did we supply fixed-point data AND it needs normalizing?
		FSIZE * 7, 			// Stride -- how many bytes used to store each vertex?
										// (x,y,z,w, r,g,b) * bytes/value
		FSIZE * 4);			// Offset -- how many bytes from START of buffer to the
										// value we will actually use?  Need to skip over x,y,z,w
										
	gl.enableVertexAttribArray(a_Color);  
										// Enable assignment of vertex buffer object's position data

	//--------------------------------DONE!
  	// Unbind the buffer object 
  	gl.bindBuffer(gl.ARRAY_BUFFER, null);

  	return nn;
}

// simple & quick-- 
// I didn't use any arguments such as color choices, # of verts,slices,bars, etc.
// YOU can improve these functions to accept useful arguments...
//
function makeDiamond() {
//==============================================================================
// Make a diamond-like shape from two adjacent tetrahedra, aligned with Z axis.
diamondVerts = new Float32Array([

// Triangle 1
	0.0, 0.0, 0.0, 1.0,			1.0, 1.0, 1.0,		//Node 1
	0.25, 0.5, 0.0, 1.0,		0.0, 0.0, 1.0,		//Node 2
	0.0, 0.5, -0.25, 1.0,		1.0, 1.0, 0.0,		//Node 5

	// Triangle 2 
	0.0, 0.0, 0.0, 1.0,			1.0, 1.0, 1.0,		//Node 1
	-0.25, 0.5, 0.0, 1.0,		1.0, 0.0, 0.0,		//Node 4
	0.0, 0.5, -0.25, 1.0,		1.0, 1.0, 0.0,		//Node 5

	// Triangle 3
	0.0, 0.0, 0.0, 1.0,			1.0, 1.0, 1.0,		//Node 1
	0.0, 0.5, 0.25, 1.0,		0.0, 1.0, 0.0,		//Node 3
	-0.25, 0.5, 0.0, 1.0,		1.0, 0.0, 0.0,		//Node 4

	// Triangle 4
	0.0, 0.0, 0.0, 1.0,			1.0, 1.0, 1.0,		//Node 1
	0.25, 0.5, 0.0, 1.0,		0.0, 0.0, 1.0,		//Node 2
	0.0, 0.5, 0.25, 1.0,		0.0, 1.0, 0.0,		//Node 3

	// Triangle 5
	0.0, 1.0, 0.0, 1.0,			0.0, 0.0, 0.0,		//Node 0
	0.25, 0.5, 0.0, 1.0,		0.0, 0.0, 1.0,		//Node 2
	0.0, 0.5, -0.25, 1.0,		1.0, 1.0, 0.0,		//Node 5

	// Triangle 6
	0.0, 1.0, 0.0, 1.0,			0.0, 0.0, 0.0,		//Node 0
	-0.25, 0.5, 0.0, 1.0,		1.0, 0.0, 0.0,		//Node 4
	0.0, 0.5, -0.25, 1.0,		1.0, 1.0, 0.0,		//Node 5

	// Triangle 7
	0.0, 1.0, 0.0, 1.0,			0.0, 0.0, 0.0,		//Node 0
	0.0, 0.5, 0.25, 1.0,		0.0, 1.0, 0.0,		//Node 3
	-0.25, 0.5, 0.0, 1.0,		1.0, 0.0, 0.0,		//Node 4

	// Triangle 8
	0.0, 1.0, 0.0, 1.0,			0.0, 0.0, 0.0,		//Node 0
	0.25, 0.5, 0.0, 1.0,		0.0, 0.0, 1.0,		//Node 2
	0.0, 0.5, 0.25, 1.0,		0.0, 1.0, 0.0,		//Node 3

])
	// YOU write this one...
	
}

function makeHouse() {
houseVerts = new Float32Array([ 
	// Triangle 1
     -0.5, -0.5, 0.5,1.0,		0.0, 0.0, 1.0,		//Node F
     -0.5, 0.5, 0.5,1.0,		1.0, 0.0, 0.0,		//Node A
     0.5, 0.5, 0.5,	1.0,		0.0, 1.0, 0.0,		//Node B

     // Triangle 2
     -0.5, -0.5, 0.5,1.0,		0.0, 0.0, 1.0,		//Node F
     0.5, -0.5, 0.5,1.0,		1.0, 1.0, 0.0,		//Node G
     0.5, 0.5, 0.5,	1.0,		0.0, 1.0, 0.0,		//Node B

     // Triangle 3
     -0.5, -0.5, -0.5,1.0,		0.0, 1.0, 0.0,		//Node I
     -0.5, 0.5, -0.5,1.0,		1.0, 1.0, 0.0,		//Node D
     0.5, 0.5, -0.5,1.0,		0.0, 0.0, 1.0,		//Node C

     // Triangle 4
     -0.5, -0.5, -0.5,1.0,		0.0, 1.0, 0.0,		//Node I
     0.5, -0.5, -0.5,1.0,		1.0, 0.0, 0.0,		//Node H
     0.5, 0.5, -0.5,1.0,		0.0, 0.0, 1.0,		//Node C

     // Triangle 5
     -0.5, -0.5, 0.5,1.0,		0.0, 0.0, 1.0,		//Node F
     -0.5, -0.5, -0.5,1.0,		0.0, 1.0, 0.0,		//Node I
     0.5, -0.5, -0.5,1.0,		1.0, 0.0, 0.0,		//Node H

     // Triangle 6
     -0.5, -0.5, 0.5,1.0,		0.0, 0.0, 1.0,		//Node F
     0.5, -0.5, 0.5,1.0,		1.0, 1.0, 0.0,		//Node G
     0.5, -0.5, -0.5,1.0,		1.0, 0.0, 0.0,		//Node H

     // Triangle 7
     -0.5, -0.5, 0.5,1.0,		0.0, 0.0, 1.0,		//Node F
     -0.5, 0.5, 0.5,1.0,		1.0, 0.0, 0.0,		//Node A
     -0.5, 0.5, -0.5,1.0,		1.0, 1.0, 0.0,		//Node D

     // Triangle 8
     -0.5, -0.5, 0.5,1.0,		0.0, 0.0, 1.0,		//Node F
     -0.5, -0.5, -0.5,1.0,		0.0, 1.0, 0.0,		//Node I
     -0.5, 0.5, -0.5,1.0,		1.0, 1.0, 0.0,		//Node D

     // Triangle 9
     0.5, -0.5, 0.5,1.0,		1.0, 1.0, 0.0,		//Node G
     0.5, 0.5, 0.5,	1.0,		0.0, 1.0, 0.0,		//Node B
     0.5, 0.5, -0.5,1.0,		0.0, 0.0, 1.0,		//Node C

     // Triangle 10
     0.5, -0.5, 0.5,1.0,		1.0, 1.0, 0.0,		//Node G
     0.5, -0.5, -0.5,1.0,		1.0, 0.0, 0.0,		//Node H
     0.5, 0.5, -0.5,1.0,		0.0, 0.0, 1.0,		//Node C

     // Triangle 11
     -0.5, 0.5, 0.5,1.0,		1.0, 0.0, 0.0,		//Node A
     0.5, 0.5, 0.5,	1.0,		0.0, 1.0, 0.0,		//Node B
     0.0, 0.95, 0.0,1.0,		1.0, 1.0, 1.0,		//Node E

     // Triangle 12
     0.5, 0.5, 0.5,	1.0,		0.0, 1.0, 0.0,		//Node B
     0.5, 0.5, -0.5,1.0,		0.0, 0.0, 1.0,		//Node C
     0.0, 0.95, 0.0,1.0,		1.0, 1.0, 1.0,		//Node E

     // Triangle 13
     0.5, 0.5, -0.5,1.0,		0.0, 0.0, 1.0,		//Node C
     -0.5, 0.5, -0.5,1.0,		1.0, 1.0, 0.0,		//Node D
     0.0, 0.95, 0.0,1.0,		1.0, 1.0, 1.0,		//Node E

     // Triangle 14
     -0.5, 0.5, -0.5,1.0,		1.0, 1.0, 0.0,		//Node D
     -0.5, 0.5, 0.5,1.0,		1.0, 0.0, 0.0,		//Node A
     0.0, 0.95, 0.0,1.0,		1.0, 1.0, 1.0,		//Node E
])

}

function makePyramid() {
//==============================================================================
// Make a 4-cornered pyramid from one OpenGL TRIANGLE_STRIP primitive.
// All vertex coords are +/1 or zero; pyramid base is in xy plane. 
/*
	0.0, 0.0, 0.0, 1.0,			0.0, 0.0, 0.0,		//Node 0
	1.0, 0.0, 0.0, 1.0,			1.0, 0.0, 0.0,		//Node 1
	0.0, 1.0, 0.0, 1.0,			0.0, 1.0, 0.0,		//Node 2
	0.0, 0.0, 1.0, 1.0,			0.0, 0.0, 1.0,		//Node 3
	*/
pyramidVerts = new Float32Array([ 
	//Triangle 1
	0.0, 0.0, 0.0, 1.0,			0.0, 0.0, 0.0,		//Node 0
	1.0, 0.0, 0.0, 1.0,			1.0, 0.0, 0.0,		//Node 1
	0.0, 1.0, 0.0, 1.0,			0.0, 1.0, 0.0,		//Node 2

	//Triangle 2
	1.0, 0.0, 0.0, 1.0,			1.0, 0.0, 0.0,		//Node 1
	0.0, 1.0, 0.0, 1.0,			0.0, 1.0, 0.0,		//Node 2
	0.0, 0.0, 1.0, 1.0,			0.0, 0.0, 1.0,		//Node 3

	//Triangle 3
	0.0, 0.0, 0.0, 1.0,			0.0, 0.0, 0.0,		//Node 0
	0.0, 1.0, 0.0, 1.0,			0.0, 1.0, 0.0,		//Node 2
	0.0, 0.0, 1.0, 1.0,			0.0, 0.0, 1.0,		//Node 3

	//Triangle 4
	0.0, 0.0, 0.0, 1.0,			0.0, 0.0, 0.0,		//Node 0
	1.0, 0.0, 0.0, 1.0,			1.0, 0.0, 0.0,		//Node 1
	0.0, 0.0, 1.0, 1.0,			0.0, 0.0, 1.0,		//Node 3
])

  	// YOU write this one...
}


function makeCylinder() {
//==============================================================================
// Make a cylinder shape from one TRIANGLE_STRIP drawing primitive, using the
// 'stepped spiral' design described in notes.
// Cylinder center at origin, encircles z axis, radius 1, top/bottom at z= +/-1.
//
	var ctrColr = new Float32Array([0.2, 0.2, 0.2]);	// dark gray
	var topColr = new Float32Array([0.4, 0.7, 0.4]);	// light green
	var botColr = new Float32Array([0.5, 0.5, 1.0]);	// light blue
	var capVerts = 16;	// # of vertices around the topmost 'cap' of the shape
	var botRadius = 1.6;		// radius of bottom of cylinder (top always 1.0)
	
	// Create a (global) array to hold this cylinder's vertices;
	cylVerts = new Float32Array(  ((capVerts*6) -2) * floatsPerVertex);  // # of vertices * # of elements needed to store them. 

	// Create circle-shaped top cap of cylinder at z=+1.0, radius 1.0
	// v counts vertices: j counts array elements (vertices * elements per vertex)
	for(v=1,j=0; v<2*capVerts; v++,j+=floatsPerVertex) {	
		// skip the first vertex--not needed.
		if(v%2==0)
		{				// put even# vertices at center of cylinder's top cap:
			cylVerts[j  ] = 0.0; 			// x,y,z,w == 0,0,1,1
			cylVerts[j+1] = 0.0;	
			cylVerts[j+2] = 1.0; 
			cylVerts[j+3] = 1.0;			// r,g,b = topColr[]
			cylVerts[j+4]=ctrColr[0]; 
			cylVerts[j+5]=ctrColr[1]; 
			cylVerts[j+6]=ctrColr[2];
		}
		else { 	// put odd# vertices around the top cap's outer edge;
						// x,y,z,w == cos(theta),sin(theta), 1.0, 1.0
						// 					theta = 2*PI*((v-1)/2)/capVerts = PI*(v-1)/capVerts
			cylVerts[j  ] = Math.cos(Math.PI*(v-1)/capVerts);			// x
			cylVerts[j+1] = Math.sin(Math.PI*(v-1)/capVerts);			// y
			//	(Why not 2*PI? because 0 < =v < 2*capVerts, so we
			//	 can simplify cos(2*PI * (v-1)/(2*capVerts))
			cylVerts[j+2] = 1.0;	// z
			cylVerts[j+3] = 1.0;	// w.
			// r,g,b = topColr[]
			cylVerts[j+4]=topColr[0]; 
			cylVerts[j+5]=topColr[1]; 
			cylVerts[j+6]=topColr[2];			
		}
	}
	// Create the cylinder side walls, made of 2*capVerts vertices.
	// v counts vertices within the wall; j continues to count array elements
	for(v=0; v< 2*capVerts; v++, j+=floatsPerVertex) {
		if(v%2==0)	// position all even# vertices along top cap:
		{		
				cylVerts[j  ] = Math.cos(Math.PI*(v)/capVerts);		// x
				cylVerts[j+1] = Math.sin(Math.PI*(v)/capVerts);		// y
				cylVerts[j+2] = 1.0;	// z
				cylVerts[j+3] = 1.0;	// w.
				// r,g,b = topColr[]
				cylVerts[j+4]=topColr[0]; 
				cylVerts[j+5]=topColr[1]; 
				cylVerts[j+6]=topColr[2];			
		}
		else		// position all odd# vertices along the bottom cap:
		{
				cylVerts[j  ] = botRadius * Math.cos(Math.PI*(v-1)/capVerts);		// x
				cylVerts[j+1] = botRadius * Math.sin(Math.PI*(v-1)/capVerts);		// y
				cylVerts[j+2] =-1.0;	// z
				cylVerts[j+3] = 1.0;	// w.
				// r,g,b = topColr[]
				cylVerts[j+4]=botColr[0]; 
				cylVerts[j+5]=botColr[1]; 
				cylVerts[j+6]=botColr[2];			
		}
	}
	// Create the cylinder bottom cap, made of 2*capVerts -1 vertices.
	// v counts the vertices in the cap; j continues to count array elements
	for(v=0; v < (2*capVerts -1); v++, j+= floatsPerVertex) {
		if(v%2==0) {	// position even #'d vertices around bot cap's outer edge
			cylVerts[j  ] = botRadius * Math.cos(Math.PI*(v)/capVerts);		// x
			cylVerts[j+1] = botRadius * Math.sin(Math.PI*(v)/capVerts);		// y
			cylVerts[j+2] =-1.0;	// z
			cylVerts[j+3] = 1.0;	// w.
			// r,g,b = topColr[]
			cylVerts[j+4]=botColr[0]; 
			cylVerts[j+5]=botColr[1]; 
			cylVerts[j+6]=botColr[2];		
		}
		else {				// position odd#'d vertices at center of the bottom cap:
			cylVerts[j  ] = 0.0; 			// x,y,z,w == 0,0,-1,1
			cylVerts[j+1] = 0.0;	
			cylVerts[j+2] =-1.0; 
			cylVerts[j+3] = 1.0;			// r,g,b = botColr[]
			cylVerts[j+4]=botColr[0]; 
			cylVerts[j+5]=botColr[1]; 
			cylVerts[j+6]=botColr[2];
		}
	}
}

function makeSphere() {
//==============================================================================
// Make a sphere from one OpenGL TRIANGLE_STRIP primitive.   Make ring-like 
// equal-lattitude 'slices' of the sphere (bounded by planes of constant z), 
// and connect them as a 'stepped spiral' design (see makeCylinder) to build the
// sphere from one triangle strip.
	var slices = 13;		// # of slices of the sphere along the z axis. >=3 req'd
												// (choose odd # or prime# to avoid accidental symmetry)
	var sliceVerts	= 27;	// # of vertices around the top edge of the slice
												// (same number of vertices on bottom of slice, too)
	var topColr = new Float32Array([0.7, 0.7, 0.7]);	// North Pole: light gray
	var equColr = new Float32Array([0.3, 0.7, 0.3]);	// Equator:    bright green
	var botColr = new Float32Array([0.9, 0.9, 0.9]);	// South Pole: brightest gray.
	var sliceAngle = Math.PI/slices;	// lattitude angle spanned by one slice.

		// Create a (global) array to hold this sphere's vertices:
	sphVerts = new Float32Array(  ((slices * 2* sliceVerts) -2) * floatsPerVertex);
											// # of vertices * # of elements needed to store them. 
											// each slice requires 2*sliceVerts vertices except 1st and
											// last ones, which require only 2*sliceVerts-1.
										
	// Create dome-shaped top slice of sphere at z=+1
	// s counts slices; v counts vertices; 
	// j counts array elements (vertices * elements per vertex)
	var cos0 = 0.0;					// sines,cosines of slice's top, bottom edge.
	var sin0 = 0.0;
	var cos1 = 0.0;
	var sin1 = 0.0;	
	var j = 0;							// initialize our array index
	var isLast = 0;
	var isFirst = 1;
	for(s=0; s<slices; s++) {	// for each slice of the sphere,
		// find sines & cosines for top and bottom of this slice
		if(s==0) {
			isFirst = 1;	// skip 1st vertex of 1st slice.
			cos0 = 1.0; 	// initialize: start at north pole.
			sin0 = 0.0;
		}
		else {					// otherwise, new top edge == old bottom edge
			isFirst = 0;	
			cos0 = cos1;
			sin0 = sin1;
		}								// & compute sine,cosine for new bottom edge.
		cos1 = Math.cos((s+1)*sliceAngle);
		sin1 = Math.sin((s+1)*sliceAngle);
		// go around the entire slice, generating TRIANGLE_STRIP verts
		// (Note we don't initialize j; grows with each new attrib,vertex, and slice)
		if(s==slices-1) isLast=1;	// skip last vertex of last slice.
		for(v=isFirst; v< 2*sliceVerts-isLast; v++, j+=floatsPerVertex) {	
			if(v%2==0)
			{				// put even# vertices at the the slice's top edge
							// (why PI and not 2*PI? because 0 <= v < 2*sliceVerts
							// and thus we can simplify cos(2*PI(v/2*sliceVerts))  
				sphVerts[j  ] = sin0 * Math.cos(Math.PI*(v)/sliceVerts); 	
				sphVerts[j+1] = sin0 * Math.sin(Math.PI*(v)/sliceVerts);	
				sphVerts[j+2] = cos0;		
				sphVerts[j+3] = 1.0;			
			}
			else { 	// put odd# vertices around the slice's lower edge;
							// x,y,z,w == cos(theta),sin(theta), 1.0, 1.0
							// 					theta = 2*PI*((v-1)/2)/capVerts = PI*(v-1)/capVerts
				sphVerts[j  ] = sin1 * Math.cos(Math.PI*(v-1)/sliceVerts);		// x
				sphVerts[j+1] = sin1 * Math.sin(Math.PI*(v-1)/sliceVerts);		// y
				sphVerts[j+2] = cos1;																				// z
				sphVerts[j+3] = 1.0;																				// w.		
			}
			if(s==0) {	// finally, set some interesting colors for vertices:
				sphVerts[j+4]=topColr[0]; 
				sphVerts[j+5]=topColr[1]; 
				sphVerts[j+6]=topColr[2];	
				}
			else if(s==slices-1) {
				sphVerts[j+4]=botColr[0]; 
				sphVerts[j+5]=botColr[1]; 
				sphVerts[j+6]=botColr[2];	
			}
			else {
					sphVerts[j+4]=Math.random();// equColr[0]; 
					sphVerts[j+5]=Math.random();// equColr[1]; 
					sphVerts[j+6]=Math.random();// equColr[2];					
			}
		}
	}
}

function makeTorus() {
//==============================================================================
// 		Create a torus centered at the origin that circles the z axis.  
// Terminology: imagine a torus as a flexible, cylinder-shaped bar or rod bent 
// into a circle around the z-axis. The bent bar's centerline forms a circle
// entirely in the z=0 plane, centered at the origin, with radius 'rbend'.  The 
// bent-bar circle begins at (rbend,0,0), increases in +y direction to circle  
// around the z-axis in counter-clockwise (CCW) direction, consistent with our
// right-handed coordinate system.
// 		This bent bar forms a torus because the bar itself has a circular cross-
// section with radius 'rbar' and angle 'phi'. We measure phi in CCW direction 
// around the bar's centerline, circling right-handed along the direction 
// forward from the bar's start at theta=0 towards its end at theta=2PI.
// 		THUS theta=0, phi=0 selects the torus surface point (rbend+rbar,0,0);
// a slight increase in phi moves that point in -z direction and a slight
// increase in theta moves that point in the +y direction.  
// To construct the torus, begin with the circle at the start of the bar:
//					xc = rbend + rbar*cos(phi); 
//					yc = 0; 
//					zc = -rbar*sin(phi);			(note negative sin(); right-handed phi)
// and then rotate this circle around the z-axis by angle theta:
//					x = xc*cos(theta) - yc*sin(theta) 	
//					y = xc*sin(theta) + yc*cos(theta)
//					z = zc
// Simplify: yc==0, so
//					x = (rbend + rbar*cos(phi))*cos(theta)
//					y = (rbend + rbar*cos(phi))*sin(theta) 
//					z = -rbar*sin(phi)
// To construct a torus from a single triangle-strip, make a 'stepped spiral' 
// along the length of the bent bar; successive rings of constant-theta, using 
// the same design used for cylinder walls in 'makeCyl()' and for 'slices' in 
// makeSphere().  Unlike the cylinder and sphere, we have no 'special case' 
// for the first and last of these bar-encircling rings.
//
var rbend = 1.0;										// Radius of circle formed by torus' bent bar
var rbar = 0.5;											// radius of the bar we bent to form torus
var barSlices = 23;									// # of bar-segments in the torus: >=3 req'd;
																		// more segments for more-circular torus
var barSides = 13;										// # of sides of the bar (and thus the 
																		// number of vertices in its cross-section)
																		// >=3 req'd;
																		// more sides for more-circular cross-section
// for nice-looking torus with approx square facets, 
//			--choose odd or prime#  for barSides, and
//			--choose pdd or prime# for barSlices of approx. barSides *(rbend/rbar)
// EXAMPLE: rbend = 1, rbar = 0.5, barSlices =23, barSides = 11.

	// Create a (global) array to hold this torus's vertices:
 torVerts = new Float32Array(floatsPerVertex*(2*barSides*barSlices +2));
//	Each slice requires 2*barSides vertices, but 1st slice will skip its first 
// triangle and last slice will skip its last triangle. To 'close' the torus,
// repeat the first 2 vertices at the end of the triangle-strip.  Assume 7

var phi=0, theta=0;										// begin torus at angles 0,0
var thetaStep = 2*Math.PI/barSlices;	// theta angle between each bar segment
var phiHalfStep = Math.PI/barSides;		// half-phi angle between each side of bar
																			// (WHY HALF? 2 vertices per step in phi)
	// s counts slices of the bar; v counts vertices within one slice; j counts
	// array elements (Float32) (vertices*#attribs/vertex) put in torVerts array.
	for(s=0,j=0; s<barSlices; s++) {		// for each 'slice' or 'ring' of the torus:
		for(v=0; v< 2*barSides; v++, j+=7) {		// for each vertex in this slice:
			if(v%2==0)	{	// even #'d vertices at bottom of slice,
				torVerts[j  ] = (rbend + rbar*Math.cos((v)*phiHalfStep)) * 
																						 Math.cos((s)*thetaStep);
							  //	x = (rbend + rbar*cos(phi)) * cos(theta)
				torVerts[j+1] = (rbend + rbar*Math.cos((v)*phiHalfStep)) *
																						 Math.sin((s)*thetaStep);
								//  y = (rbend + rbar*cos(phi)) * sin(theta) 
				torVerts[j+2] = -rbar*Math.sin((v)*phiHalfStep);
								//  z = -rbar  *   sin(phi)
				torVerts[j+3] = 1.0;		// w
			}
			else {				// odd #'d vertices at top of slice (s+1);
										// at same phi used at bottom of slice (v-1)
				torVerts[j  ] = (rbend + rbar*Math.cos((v-1)*phiHalfStep)) * 
																						 Math.cos((s+1)*thetaStep);
							  //	x = (rbend + rbar*cos(phi)) * cos(theta)
				torVerts[j+1] = (rbend + rbar*Math.cos((v-1)*phiHalfStep)) *
																						 Math.sin((s+1)*thetaStep);
								//  y = (rbend + rbar*cos(phi)) * sin(theta) 
				torVerts[j+2] = -rbar*Math.sin((v-1)*phiHalfStep);
								//  z = -rbar  *   sin(phi)
				torVerts[j+3] = 1.0;		// w
			}
			torVerts[j+4] = Math.random();		// random color 0.0 <= R < 1.0
			torVerts[j+5] = Math.random();		// random color 0.0 <= G < 1.0
			torVerts[j+6] = Math.random();		// random color 0.0 <= B < 1.0
		}
	}
	// Repeat the 1st 2 vertices of the triangle strip to complete the torus:
			torVerts[j  ] = rbend + rbar;	// copy vertex zero;
						  //	x = (rbend + rbar*cos(phi==0)) * cos(theta==0)
			torVerts[j+1] = 0.0;
							//  y = (rbend + rbar*cos(phi==0)) * sin(theta==0) 
			torVerts[j+2] = 0.0;
							//  z = -rbar  *   sin(phi==0)
			torVerts[j+3] = 1.0;		// w
			torVerts[j+4] = Math.random();		// random color 0.0 <= R < 1.0
			torVerts[j+5] = Math.random();		// random color 0.0 <= G < 1.0
			torVerts[j+6] = Math.random();		// random color 0.0 <= B < 1.0
			j+=7; // go to next vertex:
			torVerts[j  ] = (rbend + rbar) * Math.cos(thetaStep);
						  //	x = (rbend + rbar*cos(phi==0)) * cos(theta==thetaStep)
			torVerts[j+1] = (rbend + rbar) * Math.sin(thetaStep);
							//  y = (rbend + rbar*cos(phi==0)) * sin(theta==thetaStep) 
			torVerts[j+2] = 0.0;
							//  z = -rbar  *   sin(phi==0)
			torVerts[j+3] = 1.0;		// w
			torVerts[j+4] = Math.random();		// random color 0.0 <= R < 1.0
			torVerts[j+5] = Math.random();		// random color 0.0 <= G < 1.0
			torVerts[j+6] = Math.random();		// random color 0.0 <= B < 1.0
}

function makeAxes() {

axesVerts = new Float32Array([

	-50, 0.0, 0.0, 1.0,		1.0, 0.0, 0.0,
	50, 0.0, 0.0, 1.0, 		1.0, 0.0, 0.0,

	0.0, -50.0, 0.0, 1.0, 	0.0, 1.0, 0.0,
	0.0, 50.0, 0.0, 1.0, 	0.0, 1.0, 0.0,

	0.0, 0.0, -50.0, 1.0, 	0.0, 0.0, 1.0,
	0.0, 0.0, 50.0, 1.0, 	0.0, 0.0, 1.0,

])
}

function makeGroundGrid() {
//==============================================================================
// Create a list of vertices that create a large grid of lines in the x,y plane
// centered at x=y=z=0.  Draw this shape using the GL_LINES primitive.

	var xcount = 100;			// # of lines to draw in x,y to make the grid.
	var ycount = 100;		
	var xymax	= 100.0;			// grid size; extends to cover +/-xymax in x and y.
 	var xColr = new Float32Array([1.0, 1.0, 0.3]);	// bright yellow
 	var yColr = new Float32Array([0.5, 1.0, 0.5]);	// bright green.
 	
	// Create an (global) array to hold this ground-plane's vertices:
	gndVerts = new Float32Array(floatsPerVertex*2*(xcount+ycount));
						// draw a grid made of xcount+ycount lines; 2 vertices per line.
						
	var xgap = xymax/(xcount-1);		// HALF-spacing between lines in x,y;
	var ygap = xymax/(ycount-1);		// (why half? because v==(0line number/2))
	
	// First, step thru x values as we make vertical lines of constant-x:
	for(v=0, j=0; v<2*xcount; v++, j+= floatsPerVertex) {
		if(v%2==0) {	// put even-numbered vertices at (xnow, -xymax, 0)
			gndVerts[j  ] = -xymax + (v  )*xgap;	// x
			gndVerts[j+1] = -xymax;								// y
			gndVerts[j+2] = 0.0;									// z
			gndVerts[j+3] = 1.0;									// w.
		}
		else {				// put odd-numbered vertices at (xnow, +xymax, 0).
			gndVerts[j  ] = -xymax + (v-1)*xgap;	// x
			gndVerts[j+1] = xymax;								// y
			gndVerts[j+2] = 0.0;									// z
			gndVerts[j+3] = 1.0;									// w.
		}
		gndVerts[j+4] = xColr[0];			// red
		gndVerts[j+5] = xColr[1];			// grn
		gndVerts[j+6] = xColr[2];			// blu
	}
	// Second, step thru y values as wqe make horizontal lines of constant-y:
	// (don't re-initialize j--we're adding more vertices to the array)
	for(v=0; v<2*ycount; v++, j+= floatsPerVertex) {
		if(v%2==0) {		// put even-numbered vertices at (-xymax, ynow, 0)
			gndVerts[j  ] = -xymax;								// x
			gndVerts[j+1] = -xymax + (v  )*ygap;	// y
			gndVerts[j+2] = 0.0;									// z
			gndVerts[j+3] = 1.0;									// w.
		}
		else {					// put odd-numbered vertices at (+xymax, ynow, 0).
			gndVerts[j  ] = xymax;								// x
			gndVerts[j+1] = -xymax + (v-1)*ygap;	// y
			gndVerts[j+2] = 0.0;									// z
			gndVerts[j+3] = 1.0;									// w.
		}
		gndVerts[j+4] = yColr[0];			// red
		gndVerts[j+5] = yColr[1];			// grn
		gndVerts[j+6] = yColr[2];			// blu
	}
}

function drawProjected(gl, n, currentAngle, modelMatrix, u_ModelMatrix, eye_position, lookat_position) {

	console.log("drawProjected");
	console.log(eye_position);
	console.log(lookat_position);
	console.log(g_theta);
	console.log(g_zOffset);

	// SAVE lens world coord;  
	pushMatrix(modelMatrix);

	// Camera position
	modelMatrix.lookAt( eye_position[0], eye_position[1], eye_position[2],	// center of projection
		lookat_position[0], lookat_position[1], lookat_position[2],	// look-at point 
		0, 0, 1);	// View UP vector.







 
	// --------- Draw Mouse Rotating Crystal

	// SAVE world coord system;  
	pushMatrix(modelMatrix);

	modelMatrix.translate(0.0, 0.0, 1.0);

	quatMatrix.setFromQuat(qTot.x, qTot.y, qTot.z, qTot.w);	// Quaternion-->Matrix
	
	modelMatrix.concat(quatMatrix);	// apply that matrix.

	modelMatrix.scale(0.6, 0.6, 0.6);
	//-------------------------------
	// Drawing:
	// Use the current ModelMatrix to transform & draw something new from our VBO:



	gl.uniformMatrix4fv(u_ModelMatrix, false, modelMatrix.elements);

	gl.drawArrays(gl.TRIANGLE_STRIP,				// use this drawing primitive, and
    							diamondStart/floatsPerVertex, // start at this vertex number, and
								diamondVerts.length/floatsPerVertex);	// draw this many vertices.

	modelMatrix.rotate(90, 1, 0, 0);

	gl.uniformMatrix4fv(u_ModelMatrix, false, modelMatrix.elements);

	gl.drawArrays(gl.TRIANGLE_STRIP,				// use this drawing primitive, and
    							diamondStart/floatsPerVertex, // start at this vertex number, and
								diamondVerts.length/floatsPerVertex);	// draw this many vertices.

	modelMatrix.rotate(90, 1, 0, 0);

	gl.uniformMatrix4fv(u_ModelMatrix, false, modelMatrix.elements);

	gl.drawArrays(gl.TRIANGLE_STRIP,				// use this drawing primitive, and
    							diamondStart/floatsPerVertex, // start at this vertex number, and
								diamondVerts.length/floatsPerVertex);	// draw this many vertices.

	modelMatrix.rotate(90, 1, 0, 0);

	gl.uniformMatrix4fv(u_ModelMatrix, false, modelMatrix.elements);

	gl.drawArrays(gl.TRIANGLE_STRIP,				// use this drawing primitive, and
    							diamondStart/floatsPerVertex, // start at this vertex number, and
								diamondVerts.length/floatsPerVertex);	// draw this many vertices.

	modelMatrix.translate(0.0, -0.18, -0.18);
	modelMatrix.rotate(45, 1, 0, 0);
	modelMatrix.scale(0.2, 0.5, 1.0);


	gl.uniformMatrix4fv(u_ModelMatrix, false, modelMatrix.elements);

	gl.drawArrays(gl.TRIANGLE_STRIP,				// use this drawing primitive, and
    							diamondStart/floatsPerVertex, // start at this vertex number, and
								diamondVerts.length/floatsPerVertex);	// draw this many vertices.


	modelMatrix = popMatrix();  // RESTORE 'world' drawing coords.


	




	//-------- Draw Crystal Defense System:
	// SAVE world coord system;  
	pushMatrix(modelMatrix);
	
	modelMatrix.translate(-1, -1, 0.25);
	modelMatrix.rotate(90, 1, 0, 0);
	modelMatrix.scale(1,1,1);	
	modelMatrix.scale(0.4, 0.4, 0.4);

	gl.uniformMatrix4fv(u_ModelMatrix, false, modelMatrix.elements);

	gl.drawArrays(gl.TRIANGLE_STRIP,				// use this drawing prmitive, and
    							houseStart/floatsPerVertex, // start at this vertex number, and
								houseVerts.length/floatsPerVertex);	// draw this many vertices.

    //Adding the crystal
	modelMatrix.translate(0.0, 0.95, 0.0);
    modelMatrix.rotate(g_angle01, 1, 1, 0);
    gl.uniformMatrix4fv(u_ModelMatrix, false, modelMatrix.elements);
    gl.drawArrays(gl.TRIANGLE_STRIP,				// use this drawing primitive, and
    							diamondStart/floatsPerVertex, // start at this vertex number, and
								diamondVerts.length/floatsPerVertex);	// draw this many vertices.

	//Adding the pyramid
	modelMatrix.translate(0.0, 0.95, 0.0);
	modelMatrix.rotate(currentAngle*2, 0, 1, 0);
	gl.uniformMatrix4fv(u_ModelMatrix, false, modelMatrix.elements);
    gl.drawArrays(gl.TRIANGLE_STRIP,				// use this drawing primitive, and
    							pyramidStart/floatsPerVertex, // start at this vertex number, and
								pyramidVerts.length/floatsPerVertex);	// draw this many vertices.

	//Adding another Crystal
	modelMatrix.translate(0.0, 1, 0.0);
    modelMatrix.rotate(currentAngle, 0, 0, 1);
    gl.uniformMatrix4fv(u_ModelMatrix, false, modelMatrix.elements);
    gl.drawArrays(gl.TRIANGLE_STRIP,				// use this drawing primitive, and
    							diamondStart/floatsPerVertex, // start at this vertex number, and
								diamondVerts.length/floatsPerVertex);	// draw this many vertices.

	// -----------------AXES ON JOINT-----------------

	pushMatrix(modelMatrix);  // SAVE world drawing coords.
  	//---------Draw Ground Plane, without spinning.
  	// position it.
  	modelMatrix.scale(0.1, 0.1, 0.1);  // shrink by 10X:

  	// Drawing:
  	// Pass our current matrix to the vertex shaders:
    gl.uniformMatrix4fv(u_ModelMatrix, false, modelMatrix.elements);
    // Draw just the ground-plane's vertices
    gl.drawArrays(gl.LINES, 								// use this drawing primitive, and
    						  axesStart/floatsPerVertex,	// start at this vertex number, and
							  axesVerts.length/floatsPerVertex);	// draw this many vertices.
							  
	modelMatrix = popMatrix();  // RESTORE 'world' drawing coords.

	// ------------------END OF AXES-------------

	modelMatrix = popMatrix();  // RESTORE 'world' drawing coords.

	//House 1

	pushMatrix(modelMatrix);		// Saving world coord system
	
	modelMatrix.translate(1, 1, 0.25);
	modelMatrix.rotate(90, 1, 0, 0);


	pushMatrix(modelMatrix);

	modelMatrix.scale(1,1,1);

	modelMatrix.scale(0.4, 0.4, 0.4);

	gl.uniformMatrix4fv(u_ModelMatrix, false, modelMatrix.elements);

	gl.drawArrays(gl.TRIANGLE_STRIP,				// use this drawing primitive, and
    							houseStart/floatsPerVertex, // start at this vertex number, and
								houseVerts.length/floatsPerVertex);	// draw this many vertices.

	modelMatrix = popMatrix();
	modelMatrix.translate(0.0, 0.3, 0.0);
	modelMatrix.rotate(currentAngle, 0, 1, 0);
	modelMatrix.rotate(15, 0, 0, 1);

	pushMatrix(modelMatrix);

	modelMatrix.scale(0.4, 1.0, 0.4);

	gl.uniformMatrix4fv(u_ModelMatrix, false, modelMatrix.elements);
	gl.drawArrays(gl.TRIANGLE_STRIP,				// use this drawing primitive, and
    							diamondStart/floatsPerVertex, // start at this vertex number, and
								diamondVerts.length/floatsPerVertex);	// draw this many vertices.

	modelMatrix = popMatrix();

	modelMatrix.translate(0.0, 0.4, 0.0);
	modelMatrix.scale(3.0, 0.2, 3.0);

	gl.uniformMatrix4fv(u_ModelMatrix, false, modelMatrix.elements);
	gl.drawArrays(gl.TRIANGLE_STRIP,				// use this drawing primitive, and
    							diamondStart/floatsPerVertex, // start at this vertex number, and
								diamondVerts.length/floatsPerVertex);	// draw this many vertices.

	modelMatrix = popMatrix();  // RESTORE 'world' drawing coords.



	//Second house, different

	pushMatrix(modelMatrix);		// Saving world coord system
	
	modelMatrix.translate(1, -1, 0.25);
	modelMatrix.rotate(g_angle02, 0, 1, 0);
	modelMatrix.scale(0.4, 0.4, 0.4);

	gl.uniformMatrix4fv(u_ModelMatrix, false, modelMatrix.elements);

	gl.drawArrays(gl.TRIANGLE_STRIP,				// use this drawing primitive, and
    							houseStart/floatsPerVertex, // start at this vertex number, and
								houseVerts.length/floatsPerVertex);	// draw this many vertices.

	modelMatrix = popMatrix();  // RESTORE 'world' drawing coords.
	//-------
	pushMatrix(modelMatrix);

	modelMatrix.translate(1, -.25, 0.25);
	modelMatrix.rotate(g_angle02, 0, 1, 0);
	modelMatrix.scale(0.4, -0.4, 0.4);

	gl.uniformMatrix4fv(u_ModelMatrix, false, modelMatrix.elements);

	gl.drawArrays(gl.TRIANGLE_STRIP,				// use this drawing primitive, and
    							houseStart/floatsPerVertex, // start at this vertex number, and
								houseVerts.length/floatsPerVertex);	// draw this many vertices.

	modelMatrix = popMatrix();  // RESTORE 'world' drawing coords.



	//------------------------4th House thing
	pushMatrix(modelMatrix);		// Saving world coord system
	
	modelMatrix.translate(-1, 1, 0.25);
	modelMatrix.rotate(90, 1, 0, 0);
	modelMatrix.scale(0.4, 0.4, 0.4);

	gl.uniformMatrix4fv(u_ModelMatrix, false, modelMatrix.elements);

	gl.drawArrays(gl.TRIANGLE_STRIP,				// use this drawing primitive, and
    							houseStart/floatsPerVertex, // start at this vertex number, and
								houseVerts.length/floatsPerVertex);	// draw this many vertices.


	modelMatrix = popMatrix();  // RESTORE 'world' drawing coords.





	//first arm of 4th house
	pushMatrix(modelMatrix);

	modelMatrix.translate(-1.2, 1, 0.4);
	modelMatrix.rotate(90, 0, 0, 1);
	modelMatrix.scale(0.2,0.5,0.2);
	modelMatrix.rotate(g_angle03, 1, 0, 0);

	gl.uniformMatrix4fv(u_ModelMatrix, false, modelMatrix.elements);

	gl.drawArrays(gl.TRIANGLE_STRIP,				// use this drawing primitive, and
    							diamondStart/floatsPerVertex, // start at this vertex number, and
								diamondVerts.length/floatsPerVertex);	// draw this many vertices.
	
	modelMatrix = popMatrix();

	//second arm of 4th house
	pushMatrix(modelMatrix);

	modelMatrix.translate(-0.8, 1, 0.4);
	modelMatrix.rotate(90, 0, 0, 1);
	modelMatrix.scale(0.2,-0.5,0.2);
	modelMatrix.rotate(g_angle03, 1, 0, 0);

	gl.uniformMatrix4fv(u_ModelMatrix, false, modelMatrix.elements);

	gl.drawArrays(gl.TRIANGLE_STRIP,				// use this drawing primitive, and
    							diamondStart/floatsPerVertex, // start at this vertex number, and
								diamondVerts.length/floatsPerVertex);	// draw this many vertices.
	
	modelMatrix = popMatrix();
	  


	//===========================================================
  	pushMatrix(modelMatrix);  // SAVE world drawing coords.
  	//---------Draw Ground Plane, without spinning.
  	// position it.
  	modelMatrix.translate(0.4, -0.4, 0.0);	
  	modelMatrix.scale(0.1, 0.1, 0.1);  // shrink by 10X:

  	// Drawing:
  	// Pass our current matrix to the vertex shaders:
    gl.uniformMatrix4fv(u_ModelMatrix, false, modelMatrix.elements);
    // Draw just the ground-plane's vertices
    gl.drawArrays(gl.LINES, 								// use this drawing primitive, and
    						  gndStart/floatsPerVertex,	// start at this vertex number, and
							  gndVerts.length/floatsPerVertex);	// draw this many vertices.
							  
	modelMatrix = popMatrix();  // RESTORE 'world' drawing coords.

	//===========================================================
	//AXES OF THE WORLD
  	pushMatrix(modelMatrix);  // SAVE world drawing coords.
  	//---------Draw Ground Plane, without spinning.
  	// position it.
  	modelMatrix.translate(0.0, 0.0, 0.0);	
  	modelMatrix.scale(0.1, 0.1, 0.1);  // shrink by 10X:

  	// Drawing:
  	// Pass our current matrix to the vertex shaders:
    gl.uniformMatrix4fv(u_ModelMatrix, false, modelMatrix.elements);
    // Draw just the ground-plane's vertices
    gl.drawArrays(gl.LINES, 								// use this drawing primitive, and
    						  axesStart/floatsPerVertex,	// start at this vertex number, and
							  axesVerts.length/floatsPerVertex);	// draw this many vertices.
							  
	modelMatrix = popMatrix();  // RESTORE 'world' drawing coords.


	

	modelMatrix = popMatrix();  // RESTORE lense drawing coords.
}

function drawAll(gl, n, currentAngle, modelMatrix, u_ModelMatrix, eye_position, lookat_position) {
//==============================================================================
	// Clear <canvas>  colors AND the depth buffer
	gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

	//----------------------Create, fill LEFT viewport------------------------
	gl.viewport(0,
		0, 						// location(in pixels)
	  g_canvas.width/2, 		// viewport width,
	  g_canvas.height);			// viewport height in pixels.

	var vpAspect = (g_canvas.width/2) / g_canvas.height;	// onscreen aspect ratio for this camera: width/height.

	modelMatrix.setIdentity();    // DEFINE 'world-space' coords.
	
	// Define 'camera lens':
	var fovy = 40.0;
	var near = 1.0;
	var far = 100.0;
	modelMatrix.perspective(fovy,   // FOVY: top-to-bottom vertical image angle, in degrees
		vpAspect,   // Image Aspect Ratio: camera lens width/height
		near,   // camera z-near distance (always positive; frustum begins at z = -znear)
		far);  // camera z-far distance (always positive; frustum ends at z = -zfar)
	
	drawProjected(gl, n, currentAngle, modelMatrix, u_ModelMatrix, eye_position, lookat_position);

  //----------------------Create, fill RIGHT viewport------------------------
	gl.viewport(g_canvas.width/2,						// Viewport lower-left corner
		0, 												// location(in pixels)
	  g_canvas.width/2, 								// viewport width,
	  g_canvas.height);			  						// viewport height in pixels.

	vpAspect = (g_canvas.width/2) /	g_canvas.height;				// Onscreen aspect ration for this camera: width/height.

	var perspective_frustum_height = 2 * Math.tan(Math.PI/180 * fovy/2) * (far-near)/3;  // frustum height at z=(far-near)/3 distance
	var perspective_frustum_width = vpAspect * perspective_frustum_height;


	// For this viewport, set camera's eye point and the viewing volume:
	modelMatrix.setOrtho(-perspective_frustum_width/2,  //left
		perspective_frustum_width/2,  //right
		-perspective_frustum_height/2,  //bottom
		perspective_frustum_height/2,  //top
		near,  //near
		far);  //far

	drawProjected(gl, n, currentAngle, modelMatrix, u_ModelMatrix, eye_position, lookat_position);
}

// updates camera position based on keyboard input
function updateCameraPositions(eye_position, lookat_position) {
	// Update theta and zOffset
	g_theta += g_thetaRate;
	g_zOffset += g_zOffsetRate;

	// element-wise subtraction and mult of velocity
	var displacement = [];
	for(var i = 0;i<=lookat_position.length-1;i++)
  		displacement.push((lookat_position[i] - eye_position[i]) * g_lookatTranslate * 0.02);

	// element-wise add displacement to eye position
	for(var i = 0;i<=lookat_position.length-1;i++) {
		eye_position[i] += displacement[i];
	}

	// element-wise add strafing to eye position
	eye_position[0] += Math.cos(g_theta + Math.PI/2) * g_strafeTranslate * 0.02;
	eye_position[1] += Math.sin(g_theta + Math.PI/2) * g_strafeTranslate * 0.02;


	// update look at position
	lookat_position[0] = eye_position[0] + Math.cos(g_theta);
	lookat_position[1] = eye_position[1] + Math.sin(g_theta);
	lookat_position[2] = eye_position[2] + g_zOffset;

	console.log("updateCameraPosition")
	console.log(eye_position);
	console.log(lookat_position);
	console.log(displacement);
	console.log(g_theta);
	console.log(g_zOffset);
	

}

// Last time that this function was called:  (used for animation timing)
var g_last = Date.now();

function animate(angle) {
//==============================================================================
	// Calculate the elapsed time
	var now = Date.now();
	var elapsed = now - g_last;
	g_last = now;    
	// Update the current rotation angle (adjusted by the elapsed time)
	//  limit the angle to move smoothly between +20 and -85 degrees:
	//  if(angle >  120.0 && ANGLE_STEP > 0) ANGLE_STEP = -ANGLE_STEP;
	//  if(angle < -120.0 && ANGLE_STEP < 0) ANGLE_STEP = -ANGLE_STEP;

	g_angle01 =g_angle01 + (g_angle01Rate * elapsed) / 1000.0;
  if (g_angle01 > g_angle01max && g_angle01Rate >0) g_angle01Rate = -g_angle01Rate;
  if (g_angle01 < g_angle01min && g_angle01Rate <0) g_angle01Rate = -g_angle01Rate;

  g_angle02 =g_angle02 + (g_angle02Rate * elapsed) / 1000.0;
  if (g_angle02 > g_angle02max && g_angle02Rate >0) g_angle02Rate = -g_angle02Rate;
  if (g_angle02 < g_angle02min && g_angle02Rate <0) g_angle02Rate = -g_angle02Rate;

  g_angle03 =g_angle03 + (g_angle03Rate * elapsed) / 1000.0;
  if (g_angle03 > g_angle03max && g_angle03Rate >0) g_angle03Rate = -g_angle03Rate;
  if (g_angle03 < g_angle03min && g_angle03Rate <0) g_angle03Rate = -g_angle03Rate;
  
	var newAngle = angle + (ANGLE_STEP * elapsed) / 1000.0;
	return newAngle %= 360;
}


//==================HTML Button Callbacks
function nextShape() {
	shapeNum += 1;
	if(shapeNum >= shapeMax) shapeNum = 0;
}

function spinDown() {
 ANGLE_STEP -= 25; 
}

function spinUp() {
  ANGLE_STEP += 25; 
}

function runStop() {
  if(ANGLE_STEP*ANGLE_STEP > 1) {
    myTmp = ANGLE_STEP;
    ANGLE_STEP = 0;
  }
  else {
  	ANGLE_STEP = myTmp;
  }
}

function resizeCanvas() {
	//==============================================================================
	// Called when user re-sizes their browser window and on load, because our HTML file
	// contains:  <body onload="main()" onresize="winResize()">
	
	// Report our current browser-window contents:
	
	console.log('g_Canvas width,height=', g_canvas.width, g_canvas.height);		
	console.log('Browser window: innerWidth,innerHeight=', innerWidth, innerHeight);
	
	// Make canvas fill the top 70% of our browser window:
	var xtraMargin = 16;    // keep a margin (otherwise, browser adds scroll-bars)
	g_canvas.width = innerWidth - xtraMargin;
	g_canvas.height = (innerHeight*.7) - xtraMargin;
}
 

function myKeyDown(kev) {
	//===============================================================================
	// Called when user presses down ANY key on the keyboard;
	//
	// For a light, easy explanation of keyboard events in JavaScript,
	// see:    http://www.kirupa.com/html5/keyboard_events_in_javascript.htm
	// For a thorough explanation of a mess of JavaScript keyboard event handling,
	// see:    http://javascript.info/tutorial/keyboard-events
	//
	// NOTE: Mozilla deprecated the 'keypress' event entirely, and in the
	//        'keydown' event deprecated several read-only properties I used
	//        previously, including kev.charCode, kev.keyCode. 
	//        Revised 2/2019:  use kev.key and kev.code instead.
	//
	// Report EVERYTHING in console:
	  console.log(  "--kev.code:",    kev.code,   "\t\t--kev.key:",     kev.key, 
				  "\n--kev.ctrlKey:", kev.ctrlKey,  "\t--kev.shiftKey:",kev.shiftKey,
				  "\n--kev.altKey:",  kev.altKey,   "\t--kev.metaKey:", kev.metaKey);

	switch(kev.code) {
		//----------------WASD keys------------------------
		case "KeyA":
			console.log("a/A key: Strafe LEFT!\n");
			g_strafeTranslate = 1;
			console.log(g_strafeTranslate);
			break;
		case "KeyD":
			console.log("d/D key: Strafe RIGHT!\n");
			g_strafeTranslate = -1;
			console.log(g_strafeTranslate);
			break;
		case "KeyS":
			console.log("s/S key: Move BACK!\n");
			g_lookatTranslate = -1;
			console.log(g_lookatTranslate);
			break;
		case "KeyW":
			console.log("w/W key: Move FWD!\n");
			g_lookatTranslate = 1;
			console.log(g_lookatTranslate);
			break;
		//----------------Arrow keys------------------------
		case "ArrowLeft": 	
			console.log(' left-arrow.');
			g_thetaRate = 0.03;
			break;
		case "ArrowRight":
			console.log('right-arrow.');
			g_thetaRate = -0.03;
			break;
		case "ArrowUp":		
			console.log('   up-arrow.');
			g_zOffsetRate = 0.02;
			break;
		case "ArrowDown":
			console.log(' down-arrow.');
			g_zOffsetRate = -0.02;
			break;	
		default:
			console.log("UNUSED!");
			break;
	}
}


function myKeyUp(kev) {
	//===============================================================================
	// Called when user releases ANY key on the keyboard; captures scancodes well
	
	console.log('myKeyUp()--keyCode='+kev.keyCode+' released.');
	switch(kev.code) {
		//----------------WASD keys------------------------
		case "KeyA":
			g_strafeTranslate = 0;
			console.log(g_strafeTranslate);
			break;
		case "KeyD":
			g_strafeTranslate = 0;
			console.log(g_strafeTranslate);
			break;
		case "KeyS":
			g_lookatTranslate = 0;
			console.log(g_lookatTranslate);
			break;
		case "KeyW":
			g_lookatTranslate = 0;
			console.log(g_lookatTranslate);
			break;
		//----------------Arrow keys------------------------
		case "ArrowLeft": 	
			g_thetaRate = 0;
			break;
		case "ArrowRight":
			g_thetaRate = 0;
			break;
		case "ArrowUp":
			g_zOffsetRate = 0;
			break;
		case "ArrowDown":
			g_zOffsetRate = 0;
			break;	
		default:
			break;
	}

	}

function myMouseDown(ev, gl, canvas) {
//==============================================================================
// Called when user PRESSES down any mouse button;
// 									(Which button?    console.log('ev.button='+ev.button);   )
// 		ev.clientX, ev.clientY == mouse pointer location, but measured in webpage 
//		pixels: left-handed coords; UPPER left origin; Y increases DOWNWARDS (!)  

// Create right-handed 'pixel' coords with origin at WebGL canvas LOWER left;
  var rect = ev.target.getBoundingClientRect();	// get canvas corners in pixels
  var xp = ev.clientX - rect.left;									// x==0 at canvas left edge
  var yp = canvas.height - (ev.clientY - rect.top);	// y==0 at canvas bottom edge
//  console.log('myMouseDown(pixel coords): xp,yp=\t',xp,',\t',yp);
  
	// Convert to Canonical View Volume (CVV) coordinates too:
  var x = (xp - canvas.width/2)  / 		// move origin to center of canvas and
  						 (canvas.width/2);			// normalize canvas to -1 <= x < +1,
	var y = (yp - canvas.height/2) /		//										 -1 <= y < +1.
							 (canvas.height/2);
//	console.log('myMouseDown(CVV coords  ):  x, y=\t',x,',\t',y);
	
	isDrag = true;											// set our mouse-dragging flag
	xMclik = x;													// record where mouse-dragging began
	yMclik = y;
};

function myMouseMove(ev, gl, canvas) {
//==============================================================================
// Called when user MOVES the mouse with a button already pressed down.
// 									(Which button?   console.log('ev.button='+ev.button);    )
// 		ev.clientX, ev.clientY == mouse pointer location, but measured in webpage 
//		pixels: left-handed coords; UPPER left origin; Y increases DOWNWARDS (!)  

	if(isDrag==false) return;				// IGNORE all mouse-moves except 'dragging'

	// Create right-handed 'pixel' coords with origin at WebGL canvas LOWER left;
  var rect = ev.target.getBoundingClientRect();	// get canvas corners in pixels
  var xp = ev.clientX - rect.left;									// x==0 at canvas left edge
	var yp = canvas.height - (ev.clientY - rect.top);	// y==0 at canvas bottom edge
//  console.log('myMouseMove(pixel coords): xp,yp=\t',xp,',\t',yp);
  
	// Convert to Canonical View Volume (CVV) coordinates too:
  var x = (xp - canvas.width/2)  / 		// move origin to center of canvas and
  						 (canvas.width/2);			// normalize canvas to -1 <= x < +1,
	var y = (yp - canvas.height/2) /		//										 -1 <= y < +1.
							 (canvas.height/2);

	// find how far we dragged the mouse:
	xMdragTot += (x - xMclik);					// Accumulate change-in-mouse-position,&
	yMdragTot += (y - yMclik);
	// AND use any mouse-dragging we found to update quaternions qNew and qTot.
	dragQuat(x - xMclik, y - yMclik);
	
	xMclik = x;													// Make NEXT drag-measurement from here.
	yMclik = y;
	
	// Show it on our webpage, in the <div> element named 'MouseText':
	document.getElementById('MouseText').innerHTML=
			'Mouse Drag totals (CVV x,y coords):\t'+
			 xMdragTot.toFixed(5)+', \t'+
			 yMdragTot.toFixed(5);	
};

function myMouseUp(ev, gl, canvas) {
//==============================================================================
// Called when user RELEASES mouse button pressed previously.
// 									(Which button?   console.log('ev.button='+ev.button);    )
// 		ev.clientX, ev.clientY == mouse pointer location, but measured in webpage 
//		pixels: left-handed coords; UPPER left origin; Y increases DOWNWARDS (!)  

// Create right-handed 'pixel' coords with origin at WebGL canvas LOWER left;
  var rect = ev.target.getBoundingClientRect();	// get canvas corners in pixels
  var xp = ev.clientX - rect.left;									// x==0 at canvas left edge
	var yp = canvas.height - (ev.clientY - rect.top);	// y==0 at canvas bottom edge
//  console.log('myMouseUp  (pixel coords): xp,yp=\t',xp,',\t',yp);
  
	// Convert to Canonical View Volume (CVV) coordinates too:
  var x = (xp - canvas.width/2)  / 		// move origin to center of canvas and
  						 (canvas.width/2);			// normalize canvas to -1 <= x < +1,
	var y = (yp - canvas.height/2) /		//										 -1 <= y < +1.
							 (canvas.height/2);
//	console.log('myMouseUp  (CVV coords  ):  x, y=\t',x,',\t',y);
	
	isDrag = false;											// CLEAR our mouse-dragging flag, and
	// accumulate any final bit of mouse-dragging we did:
	xMdragTot += (x - xMclik);
	yMdragTot += (y - yMclik);
//	console.log('myMouseUp: xMdragTot,yMdragTot =',xMdragTot,',\t',yMdragTot);

	// AND use any mouse-dragging we found to update quaternions qNew and qTot;
	dragQuat(x - xMclik, y - yMclik);

	// Show it on our webpage, in the <div> element named 'MouseText':
	document.getElementById('MouseText').innerHTML=
			'Mouse Drag totals (CVV x,y coords):\t'+
			 xMdragTot.toFixed(5)+', \t'+
			 yMdragTot.toFixed(5);	
};

function dragQuat(xdrag, ydrag) {
//==============================================================================
// Called when user drags mouse by 'xdrag,ydrag' as measured in CVV coords.
// We find a rotation axis perpendicular to the drag direction, and convert the 
// drag distance to an angular rotation amount, and use both to set the value of 
// the quaternion qNew.  We then combine this new rotation with the current 
// rotation stored in quaternion 'qTot' by quaternion multiply.  Note the 
// 'draw()' function converts this current 'qTot' quaternion to a rotation 
// matrix for drawing. 
	var res = 5;
	var qTmp = new Quaternion(0,0,0,1);
	
	var dist = Math.sqrt(xdrag*xdrag + ydrag*ydrag);
	// console.log('xdrag,ydrag=',xdrag.toFixed(5),ydrag.toFixed(5),'dist=',dist.toFixed(5));
	
	qNew.setFromAxisAngle(-ydrag*Math.sin(g_theta) + 0.0001, ydrag*Math.cos(g_theta) + 0.0001, xdrag + 0.0001, dist*50.0);
	// (why add tiny 0.0001? To ensure we never have a zero-length rotation axis)
							// why axis (x,y,z) = (-yMdrag,+xMdrag,0)? 
							// -- to rotate around +x axis, drag mouse in -y direction.
							// -- to rotate around +z axis, drag mouse in +x direction.

	

	qTmp.multiply(qNew,qTot);			// apply new rotation to current rotation. 
	//--------------------------
	// IMPORTANT! Why qNew*qTot instead of qTot*qNew? (Try it!)
	// ANSWER: Because 'duality' governs ALL transformations, not just matrices. 
	// If we multiplied in (qTot*qNew) order, we would rotate the drawing axes
	// first by qTot, and then by qNew--we would apply mouse-dragging rotations
	// to already-rotated drawing axes.  Instead, we wish to apply the mouse-drag
	// rotations FIRST, before we apply rotations from all the previous dragging.
	//------------------------
	// IMPORTANT!  Both qTot and qNew are unit-length quaternions, but we store 
	// them with finite precision. While the product of two (EXACTLY) unit-length
	// quaternions will always be another unit-length quaternion, the qTmp length
	// may drift away from 1.0 if we repeat this quaternion multiply many times.
	// A non-unit-length quaternion won't work with our quaternion-to-matrix fcn.
	// Matrix4.prototype.setFromQuat().
//	qTmp.normalize();						// normalize to ensure we stay at length==1.0.
	qTot.copy(qTmp);
	// show the new quaternion qTot on our webpage in the <div> element 'QuatValue'
	document.getElementById('QuatValue').innerHTML= 
														 '\t X=' +qTot.x.toFixed(res)+
														'i\t Y=' +qTot.y.toFixed(res)+
														'j\t Z=' +qTot.z.toFixed(res)+
														'k\t W=' +qTot.w.toFixed(res)+
														'<br>length='+qTot.length().toFixed(res);
};

function testQuaternions() {
//==============================================================================
// Test our little "quaternion-mod.js" library with simple rotations for which 
// we know the answers; print results to make sure all functions work as 
// intended.
// 1)  Test constructors and value-setting functions:

	var res = 5;
	var myQuat = new Quaternion(1,2,3,4);		
		console.log('constructor: myQuat(x,y,z,w)=', 
		myQuat.x, myQuat.y, myQuat.z, myQuat.w);
	myQuat.clear();
		console.log('myQuat.clear()=', 
		myQuat.x.toFixed(res), myQuat.y.toFixed(res), 
		myQuat.z.toFixed(res), myQuat.w.toFixed(res));
	myQuat.set(1,2, 3,4);
		console.log('myQuat.set(1,2,3,4)=', 
		myQuat.x.toFixed(res), myQuat.y.toFixed(res), 
		myQuat.z.toFixed(res), myQuat.w.toFixed(res));
		console.log('myQuat.length()=', myQuat.length().toFixed(res));
	myQuat.normalize();
		console.log('myQuat.normalize()=', 
		myQuat.x.toFixed(res), myQuat.y.toFixed(res), myQuat.z.toFixed(res), myQuat.w.toFixed(res));
		// Simplest possible quaternions:
	myQuat.setFromAxisAngle(1,0,0,0);
		console.log('Set myQuat to 0-deg. rot. on x axis=',
		myQuat.x.toFixed(res), myQuat.y.toFixed(res), myQuat.z.toFixed(res), myQuat.w.toFixed(res));
	myQuat.setFromAxisAngle(0,1,0,0);
		console.log('set myQuat to 0-deg. rot. on y axis=',
		myQuat.x.toFixed(res), myQuat.y.toFixed(res), myQuat.z.toFixed(res), myQuat.w.toFixed(res));
	myQuat.setFromAxisAngle(0,0,1,0);
		console.log('set myQuat to 0-deg. rot. on z axis=',
		myQuat.x.toFixed(res), myQuat.y.toFixed(res), myQuat.z.toFixed(res), myQuat.w.toFixed(res), '\n');
		
	myQmat = new Matrix4();
	myQuat.setFromAxisAngle(1,0,0, 90.0);	
		console.log('set myQuat to +90-deg rot. on x axis =',
		myQuat.x.toFixed(res), myQuat.y.toFixed(res), myQuat.z.toFixed(res), myQuat.w.toFixed(res));
	myQmat.setFromQuat(myQuat.x, myQuat.y, myQuat.z, myQuat.w);
		console.log('myQuat as matrix: (+y axis <== -z axis)(+z axis <== +y axis)');
		myQmat.printMe();
	
	myQuat.setFromAxisAngle(0,1,0, 90.0);	
		console.log('set myQuat to +90-deg rot. on y axis =',
		myQuat.x.toFixed(res), myQuat.y.toFixed(res), myQuat.z.toFixed(res), myQuat.w.toFixed(res));
	myQmat.setFromQuat(myQuat.x, myQuat.y, myQuat.z, myQuat.w);
		console.log('myQuat as matrix: (+x axis <== +z axis)(+z axis <== -x axis)');
		myQmat.printMe();

	myQuat.setFromAxisAngle(0,0,1, 90.0);	
		console.log('set myQuat to +90-deg rot. on z axis =',
		myQuat.x.toFixed(res), myQuat.y.toFixed(res), myQuat.z.toFixed(res), myQuat.w.toFixed(res));
	myQmat.setFromQuat(myQuat.x, myQuat.y, myQuat.z, myQuat.w);
		console.log('myQuat as matrix: (+x axis <== -y axis)(+y axis <== +x axis)');
		myQmat.printMe();

	// Test quaternion multiply: 
	// (q1*q2) should rotate drawing axes by q1 and then by q2;  it does!
	var qx90 = new Quaternion;
	var qy90 = new Quaternion;
	qx90.setFromAxisAngle(1,0,0,90.0);			// +90 deg on x axis
	qy90.setFromAxisAngle(0,1,0,90.0);			// +90 deg on y axis.
	myQuat.multiply(qx90,qy90);
		console.log('set myQuat to (90deg x axis) * (90deg y axis) = ',
		myQuat.x.toFixed(res), myQuat.y.toFixed(res), myQuat.z.toFixed(res), myQuat.w.toFixed(res));
	myQmat.setFromQuat(myQuat.x, myQuat.y, myQuat.z, myQuat.w);
	console.log('myQuat as matrix: (+x <== +z)(+y <== +x )(+z <== +y');
	myQmat.printMe();
}

