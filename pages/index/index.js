//index.js
var util = require('../../utils/util.js');
var app = getApp()
var wxviewType = require('../../lib/wxview.js');
var moment = require('../../lib/moment.min.js');

var touchData = {
  init: function() {
    this.firstTouchX = 0;
    this.firstTouchY = 0;
    this.lastTouchX = 0;
    this.lastTouchY = 0;
    this.lastTouchTime = 0;
    this.swipeDirection = 0;  // 1-horizontal 2-vertical 0-default
    this.deltaX = 0;
    this.deltaY = 0;
    this.totalDeltaX = 0;
    this.speedY = 0;
  },
  touchstart: function(e) {
    this.init();
    this.firstTouchX = this.lastTouchX = e.touches[0].clientX;
    this.firstTouchY = this.lastTouchY = e.touches[0].clientY;
    this.lastTouchTime = e.timeStamp;
  },
  touchmove: function(e) {
    this.deltaX = e.touches[0].clientX - this.lastTouchX;
    this.deltaY = e.touches[0].clientY - this.lastTouchY;
    this.totalDeltaX += this.deltaX;

    this.lastTouchX = e.touches[0].clientX;
    this.lastTouchY = e.touches[0].clientY;
    this.lastTouchTime = e.timeStamp;

    if (this.swipeDirection === 0) {
      if (Math.abs(this.deltaX) > Math.abs(this.deltaY)) {
        this.swipeDirection = 1;
      }
      else {
        this.swipeDirection = 2;
      }
    }
  },
  touchend: function(e) {
    var deltaTime = e.timeStamp - this.lastTouchTime;
    this.speedY = this.deltaY / deltaTime;
  }
}

Page({
  data: {
    msgList:[],
    current: '',
    focus: true,
    max_id: 0
  },
  swipeCheckX:35,       //激活检测滑动的阈值
  swipeCheckY:0,
  swipeCheckState:0,    //0未激活 1激活
  maxMoveLeft:185,      //消息列表项最大左滑距离
  correctMoveLeft:175,  //显示菜单时的左滑距离
  thresholdMoveLeft: 75,//左滑阈值，超过则显示菜单
  lastShowMsgId:'',     //记录上次显示菜单的消息id
  moveX:0,              //记录平移距离
  showState:0,          //0 未显示菜单 1显示菜单
  touchStartState: 0,   // 开始触摸时的状态 0 未显示菜单 1 显示菜单

  render: function () {
    this.setData(this.renderData);
    this.renderData = {};
  },
  getRenderData: function () {
    return this.renderData;
  },

  addItem: function (event) {
    var item = {};
    item.id = 'id-' + this.data.max_id++;
    item.text = event.detail.value + item.id;
    item.create = item.update = new Date().valueOf();
    item.moment = moment(item.update, 'x').toNow();
    this.data.msgList.push(item);
    this.updateViewHeight();
    this.setData({
      msgList: this.data.msgList,
      current: '',
      focus: true,
      max_id: this.data.max_id
      });
  },
  deleteItem: function (e) {
    var animation = wx.createAnimation({ duration: 200 });
    animation.height(0).opacity(0).step();
    this.animationMsgItem(e.currentTarget.id, animation);
    var s = this;
    setTimeout(function () {
      var index = s.getItemIndex(e.currentTarget.id);
      s.data.msgList.splice(index, 1);
      s.setData({ msgList: s.data.msgList });
    }, 200);
    this.showState = 0;
    this.setData({ scrollY: true });
  },
  onLoad: function () {
    this.renderData = {};

    this.msgListView = wxviewType.createWXView();
    this.msgListView.setAnimationParam('msgListAnimation');
    this.msgListView.page = this;

    let that = this
    //获取存储信息
    console.log('onLoad, loading from storage');
    wx.getStorage({
      key: 'todos',
      success: function (res) {
        if (res.data)
          this.data.msgList = res.data.msgList;
          this.data.msgList.forEach(function (item) {
            item.moment = moment(item.update, 'x').toNow();
          });

          that.setData({
            msgList: this.data.msgList,
            max_id: res.data.max_id
          });
        console.log('Load stored data: ' + JSON.stringify(res.data))
        // console.log('todos: ' + JSON.stringify(that.data.todos))
      }
    });

    var width = app.data.deviceInfo.windowWidth;
    var height = app.data.deviceInfo.windowHeight;

    this.msgListView.setWH(width, height);
    this.updateViewHeight();
    this.swipeCheckY = util.rpx2px(50, width);
  },
  onHide: function () {
    console.log('onHide, saving to storage');
    try {
      wx.setStorageSync('todos', this.data);
    } catch (e) {
      console.log(e);
    }
  },
  updateViewHeight: function() {
    var height = util.rpx2px(150, app.data.deviceInfo.windowWidth); // row height: 150rpx -> 75px
    height *= this.data.msgList.length;
    this.msgListView.setBound(Math.min(0, app.data.deviceInfo.windowHeight - height), 0);
  },
  ontouchstart: function(e) {
    this.msgListView.ontouchstart(e);
    touchData.touchstart(e);
    if (this.showState === 1) { // if menu shown, hide it
      this.touchStartState = 0;
      this.showState = 0;
      this.moveX = 0;
      this.translateXMsgItem(this.lastShowMsgId, 0, 200);
      this.lastShowMsgId = "";
      // return;
    }
    
    if (touchData.firstTouchX > this.swipeCheckX && touchData.firstTouchY > this.swipeCheckY) {
      this.swipeCheckState = 1;
    }
  },

  ontouchmove: function(e) {
    touchData.touchmove(e);
    if (this.swipeCheckState === 0) {
      return;
    }
    //当开始触摸时有菜单显示时，不处理滑动操作
    if (this.touchStartState === 1) {
      return;
    }
    //滑动container，只处理垂直方向
    if (e.target.id === 'id-container') {
      this.msgListView.ontouchmove(e, touchData.deltaY);
      return;
    }
    //已触发垂直滑动
    if (touchData.swipeDirection === 2) { // 1-horizontal 2-vertical
      this.msgListView.ontouchmove(e, touchData.deltaY);
      return;
    }
    var moveX = touchData.totalDeltaX;
    //处理边界情况
    if (moveX > 0) {
      moveX = 0;
    }
    //检测最大左滑距离
    if (moveX < -this.maxMoveLeft) {
      moveX = -this.maxMoveLeft;
    }
    this.moveX = moveX;
    this.translateXMsgItem(e.target.id, moveX, 0);
  },
  ontouchend: function(e) {
    touchData.touchend(e);
    this.swipeCheckState = 0;
    if (this.touchStartState === 1) {
      this.touchStartState = 0;
      return;
    } 
    //滑动container，只处理垂直方向
    if (e.target.id === 'id-container') {
      this.msgListView.ontouchend(e, touchData.speedY);
      return;
    }
    //垂直滚动
    if (touchData.swipeDirection === 2) {
      this.msgListView.ontouchend(e, touchData.speedY);
      return;
    }
    if (this.moveX === 0) {
      this.showState = 0;
      return;
    }
    if (this.moveX === this.correctMoveLeft) {
      this.showState = 1;
      this.lastShowMsgId = e.target.id;
      console.log('lastShowMsgId:' + this.lastShowMsgId)
      return;
    }  
    if (this.moveX < -this.thresholdMoveLeft) {
      this.moveX = -this.correctMoveLeft;
      this.showState = 1;
      this.lastShowMsgId = e.target.id;
      console.log('lastShowMsgId2:' + this.lastShowMsgId + ', ' + this.moveX)
    }
    else {
      this.moveX = 0;
      this.showState = 0;
    }
    this.translateXMsgItem(e.target.id, this.moveX, 200);
  },
  getItemIndex: function(id) {
    var msgList = this.data.msgList;
    for (var i = 0; i < msgList.length; i++) {
      if (msgList[i].id === id) {
        return i;
      }
    }
    return -1;
  },
  translateXMsgItem: function(id, x, duration) {
    var animation = wx.createAnimation({ duration: duration });  // 动画持续时间，单位ms
    animation.translateX(x).step(); // 在X轴偏移tx，单位px; 调用动画操作方法后要调用 step() 来表示一组动画完成
    this.animationMsgItem(id, animation);
  },
  animationMsgItem: function(id, animation) {
    var index = this.getItemIndex(id);
    var param = {};
    var indexString = 'msgList[' + index + '].animation';
    param[indexString] = animation.export();  // 通过动画实例的export方法导出动画数据传递给组件的animation属性
    this.setData(param);
    // console.log('animationMsgItem:' + JSON.stringify(param));
  },
})
