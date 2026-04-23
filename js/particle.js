//这个canvas和ctx是用来绘制粒子动画的，canvas是HTML中的一个元素，ctx是canvas的2D绘图上下文，可以用来在canvas上绘制图形和动画。
const canvas = document.getElementById('particleCanvas');
const ctx = canvas.getContext('2d');

//particlesArray是一个数组，用来存储所有的粒子对象，animationId是一个变量，用来存储动画帧的ID，可以用来取消动画。
let particlesArray;
let animationId;

//mouse是一个对象，用来存储鼠标的位置和影响范围，x和y是鼠标的坐标，radius是鼠标的影响范围半径。
const mouse = {
    x: null,
    y: null,
    radius: 170
};


//查看鼠标移动事件，当鼠标移动时，更新mouse对象的x和y属性为当前鼠标的位置。
window.addEventListener('mousemove', (event) => {
    mouse.x = event.x;
    mouse.y = event.y;
});

//查看窗口大小改变事件，当窗口大小改变时，调用init函数重新初始化粒子动画。
window.addEventListener('resize', () => {
    init();
});


//Particle类是一个用来创建粒子对象的类，构造函数接受粒子的初始位置、运动方向、大小和颜色等参数，并将它们存储为对象的属性。draw方法用来在canvas上绘制粒子，update方法用来更新粒子的位置和状态，并调用draw方法重新绘制粒子。
class Particle {
    constructor(x, y, directionX, directionY, size, color) {
        this.x = x;
        this.y = y;
        this.directionX = directionX;
        this.directionY = directionY;
        this.size = size;
        this.color = color;
        this.baseX = x;
        this.baseY = y;
    }
    
    //draw方法用来在canvas上绘制粒子，使用arc方法绘制一个圆形，fillStyle设置填充颜色，fill方法填充圆形。
    draw() {
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2, false);
        ctx.fillStyle = this.color;
        ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
        ctx.fill();
    }

    //update方法用来更新粒子的位置和状态，首先根据运动方向更新粒子的位置，然后检查粒子是否超出canvas的边界，如果超出则反转运动方向。接着计算鼠标与粒子之间的距离，如果距离小于鼠标的影响范围，则根据距离计算一个力的大小和方向，调整粒子的位置，使其远离鼠标或者随机移动。最后调用draw方法重新绘制粒子。
    update() {
        this.x += this.directionX;
        this.y += this.directionY;

        if (this.x > canvas.width || this.x < 0) this.directionX = -this.directionX;
        if (this.y > canvas.height || this.y < 0) this.directionY = -this.directionY;

        let dx = mouse.x - this.x;
        let dy = mouse.y - this.y;
        let distance = Math.sqrt(dx * dx + dy * dy);

        if (distance < mouse.radius) {
            const force = (mouse.radius - distance) / mouse.radius;
            const directionX = dx / distance;
            const directionY = dy / distance;

            if (distance > 40) {
                this.x += directionX * force * 3;
                this.y += directionY * force * 3;
            } else if (distance < 30) {
                this.x -= directionX * 2;
                this.y -= directionY * 2;
            } else {
                this.x += (Math.random() - 0.5) * 0.5;
                this.y += (Math.random() - 0.5) * 0.5;
            }
        }

        this.draw();
    }
}

//init函数用来初始化粒子动画，首先设置canvas的宽度和高度为窗口的宽度和高度，然后清空particlesArray数组。接着根据canvas的面积计算需要创建的粒子数量，并使用循环创建粒子对象，随机生成粒子的初始位置、运动方向、大小和颜色，并将它们添加到particlesArray数组中。
function init() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    particlesArray = [];//particlesArray = []是因为每次调用init函数时都需要重新创建粒子对象，所以需要清空之前的粒子数组，避免重复添加粒子对象导致性能问题。
    
    let numberOfParticles = (canvas.height * canvas.width) / 9000;
    
    for (let i = 0; i < numberOfParticles; i++) {
        let size = (Math.random() * 2) + 1;
        let x = (Math.random() * (innerWidth - size * 2) - (size * 2)) + size * 2;
        let y = (Math.random() * (innerHeight - size * 2) - (size * 2)) + size * 2;
        let directionX = (Math.random() * 0.4) - 0.2;
        let directionY = (Math.random() * 0.4) - 0.2;
        let color = 'rgba(255, 255, 255, 0.8)';

        particlesArray.push(new Particle(x, y, directionX, directionY, size, color));
    }
}

//connect函数用来连接粒子之间的线条，使用双重循环遍历particlesArray数组中的每对粒子，计算它们之间的距离，如果距离小于90，则根据距离计算线条的透明度，并使用strokeStyle设置线条颜色和透明度，beginPath开始绘制路径，moveTo和lineTo方法绘制线条，最后调用stroke方法绘制线条。
function connect() {
    let opacityValue = 1;
    for (let a = 0; a < particlesArray.length; a++) {
        for (let b = a; b < particlesArray.length; b++) {
            let dx = particlesArray[a].x - particlesArray[b].x;
            let dy = particlesArray[a].y - particlesArray[b].y;
            let distance = Math.sqrt(dx * dx + dy * dy);
            //好累，鸡你太美~~
            if (distance < 90) {
                opacityValue = 1 - (distance / 90);
                ctx.strokeStyle = `rgba(0, 122, 255, ${opacityValue * 0.25})`;
                ctx.lineWidth = 1;
                ctx.beginPath();
                ctx.moveTo(particlesArray[a].x, particlesArray[a].y);
                ctx.lineTo(particlesArray[b].x, particlesArray[b].y);
                ctx.stroke();//ctx.stroke()是因为stroke()方法用来绘制路径的边框，在这里用来绘制连接粒子之间的线条，如果不调用stroke()方法，线条就不会被绘制出来。
            }
        }
    }
}

//animate函数用来执行动画，首先使用clearRect方法清空canvas，然后使用循环调用particlesArray数组中的每个粒子的update方法更新它们的位置和状态。接着调用connect函数连接粒子之间的线条，最后使用requestAnimationFrame方法递归调用animate函数，实现动画效果。
function animate() {
    ctx.clearRect(0, 0, innerWidth, innerHeight);
    for (let i = 0; i < particlesArray.length; i++) {
        particlesArray[i].update();
    }
    connect();
    animationId = requestAnimationFrame(animate);
}

//handleResize函数用来处理窗口大小改变事件，首先更新canvas的宽度和高度为新的窗口大小，然后调用init函数重新初始化粒子动画。
function handleResize() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    if (typeof init === "function") init(); 
}

//调用init函数初始化粒子动画，调用animate函数开始动画循环。
init();
animate();

//查看鼠标离开窗口事件，当鼠标离开窗口时，重置mouse对象的x和y属性为undefined，表示没有鼠标位置。
window.addEventListener('mouseout', () => {
    mouse.x = undefined;
    mouse.y = undefined;
});

