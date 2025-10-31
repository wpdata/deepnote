// components/icon/icon.js
Component({
  /**
   * 组件的属性列表
   */
  properties: {
    type: {
      type: String,
      value: ''
    },
    size: {
      type: Number,
      value: 24
    },
    color: {
      type: String,
      value: ''
    },
    className: {
      type: String,
      value: ''
    }
  },

  /**
   * 组件的初始数据
   */
  data: {
    style: ''
  },

  lifetimes: {
    attached() {
      this.updateStyle()
    }
  },

  observers: {
    'size, color': function() {
      this.updateStyle()
    }
  },

  /**
   * 组件的方法列表
   */
  methods: {
    updateStyle() {
      const { size, color } = this.properties
      let style = `font-size: ${size}rpx;`
      if (color) {
        style += `color: ${color};`
      }
      this.setData({ style })
    }
  }
})
