// node.js用来读取xls文件的包
var xls = require('node-xlrd');

// Sample表示一个样本
var Sample = function (object) {
    // 把传过来的对象上的属性克隆到新创建的样本上
    for (var key in object)
    {
        // 检验属性是否属于对象自身
        if (object.hasOwnProperty(key)) {
            this[key] = object[key];
        }
    }
}

// 计算样本间距离 采用欧式距离
Sample.prototype.measureDistances = function(a, b, c, d, e, f, g, h, i, j, k) { 
    for (var i in this.neighbors)
    {
        var neighbor = this.neighbors[i];
        var a = neighbor.a - this.a;
        var b = neighbor.b - this.b;
        var c = neighbor.c - this.c;
        var d = neighbor.d - this.d;
        var e = neighbor.e - this.e;
        var f = neighbor.f - this.f;
        var g = neighbor.g - this.g;
        var h = neighbor.h - this.h;
        var i = neighbor.i - this.i;
        var j = neighbor.j - this.j;
        var k = neighbor.k - this.k;
       
        // 计算欧式距离
        neighbor.distance = Math.sqrt(a*a + b*b + c*c + d*d + e*e + f*f + g*g + h*h + i*i + j*j + k*k);
    }
};

// 将邻居样本根据与预测样本间距离排序
Sample.prototype.sortByDistance = function() {
    this.neighbors.sort(function (a, b) {
        return a.distance - b.distance;
    });
};

// 判断被预测样本类别
Sample.prototype.guessType = function(k) {
    // 有两种类别 1和-1
    var types = { '1': 0, '-1': 0 };
    // 根据k值截取邻居里面前k个
    for (var i in this.neighbors.slice(0, k))
    {
        var neighbor = this.neighbors[i];
        types[neighbor.trueType] += 1;
    }
    
    // 判断邻居里哪个样本类型多
    if(types['1']>types['-1']){
        this.type = '1';
    } else {
        this.type = '-1';
    }
};


// SampleSet管理所有样本 参数k表示KNN中的k
var SampleSet = function(k) { 
    this.samples = [];
    this.k = k;
};

// 将样本加入样本数组
SampleSet.prototype.add = function(sample) {
    this.samples.push(sample);
}


// 构建总样本数组，包含未知类型样本
SampleSet.prototype.determineUnknown = function() {
    /*
     * 一旦发现某个未知类型样本，就把所有已知的样本 
     * 克隆出来作为该未知样本的邻居序列。
     * 之所以这样做是因为我们需要计算该未知样本和所有已知样本的距离。
     */
    for (var i in this.samples)
    {
        // 如果发现没有类型的样本
        if ( ! this.samples[i].type)
        {
            // 初始化未知样本的邻居
            this.samples[i].neighbors = [];
            
            // 生成邻居集
            for (var j in this.samples)
            {
                // 如果碰到未知样本 跳过
                if ( ! this.samples[j].type)
                    continue;
                this.samples[i].neighbors.push( new Sample(this.samples[j]) );
            }
            
            // 计算所有邻居与预测样本的距离
            this.samples[i].measureDistances(this.a, this.b, this.c, this.d, this.e, this.f, this.g, this.h, this.k);

            // 把所有邻居按距离排序
            this.samples[i].sortByDistance();

            // 猜测预测样本类型
            this.samples[i].guessType(this.k);
        }
    }
};

var data = [];
// 将文件中的数据映射到样本的属性
var map = ['a','b','c','d','e','f','g','h','i','j','k'];

// 读取文件
xls.open('data.xls', function(err,bk){
    if(err) {console.log(err.name, err.message); return;}
    var shtCount = bk.sheet.count;
    for(var sIdx = 0; sIdx < shtCount; sIdx++ ){
        var sht = bk.sheets[sIdx],
            rCount = sht.row.count,
            cCount = sht.column.count;
        for(var rIdx = 0; rIdx < rCount; rIdx++){
            var item = {};
            for(var cIdx = 0; cIdx < cCount; cIdx++){
                item[map[cIdx]] = sht.cell(rIdx,cIdx);
            }
            data.push(item);
        }
    }

    // 等文件读取完毕后 执行测试
    run();
});

function run() {
    // 提供的数据的Type放在一个独立的文件中 前43个全是“1” 这里手动添加
    for(var i = 0;i < 96;i++){
            if(i < 43){
                data[i].type = "1";
                data[i].trueType = "1";
            } else {
                data[i].type = "-1";
                data[i].trueType = "-1";
            }
    }

    // k设为4时精度还可以
    var sampleSet1 = new SampleSet(4);
    for(var m in data){
        sampleSet1.add(new Sample(data[m]));
    }

    // 留一法交叉验证开始
    var count = 0;
    for(var i = 0;i < 96;i++){
        sampleSet1.samples[i].type = undefined;
        sampleSet1.determineUnknown();
        if(sampleSet1.samples[i].type === sampleSet1.samples[i].trueType) {
            count++;
        }
    }
    console.log("留一法交叉验证的对的个数: " + count);// k为4时输出55
    var percent = count/96;
    console.log("留一法交叉验证分类精度: " + percent);// 分类精度为0.572916666666..


    // 下面做十倍交叉验证！
    // 重建一个样本集合
    var SampleSet2 = new SampleSet(9);
    var totalPercent = 0;
    for(var q in data){
        SampleSet2.add(new Sample(data[q]));
    }

    // helper函数 将数组里的元素随机摆放
    function ruffle(array) {
        array.sort(function (a, b) {
            return Math.random() - 0.5;
        })
    }

    // 将整个样本集随机打乱
    // 总共有96个样本 分为9组10个的，一组6个
    ruffle(SampleSet2.samples);
    count = 0;
    for (i = 0;i < 6;i++) {
      SampleSet2.samples[i].type = undefined;
     
    }
    SampleSet2.determineUnknown();
    for (i = 0;i < 6;i++) {
        if(SampleSet2.samples[i].type === SampleSet2.samples[i].trueType){
            count++;
        }
    }
    totalPercent = count/6;


    // 还有9次测试
    var pointer = 6;
    for (i = 0;i < 9;i++){
        count = 0;
        
        for(var index = pointer;index < pointer + 10 ;index++) {
             SampleSet2.samples[index].type = undefined;
             //console.log(index);
        }
        
        SampleSet2.determineUnknown();

        for(index = pointer;index < pointer + 10 ;index++) {
            if(SampleSet2.samples[index].type === SampleSet2.samples[index].trueType){
                count++;
            }
        }
        pointer += 10;
        totalPercent += count/10;
    }
    
    // 因为每次都把数据随机打乱一下 所以每次精度都不同
    console.log("10倍交叉验证的分类精度: "+totalPercent/10);
}















