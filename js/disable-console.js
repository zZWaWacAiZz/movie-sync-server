/**
 * 全局控制台输出控制模块
 * 用于在生产环境中关闭所有console输出
 */

(function() {
  'use strict';
  
  // 控制台输出控制配置
  const ConsoleControl = {
    // 是否禁用控制台输出
    isDisabled: true,
    
    // 原始console方法备份
    originalMethods: {},
    
    // 要禁用的console方法列表
    methodsToDisable: ['log', 'error', 'warn', 'info', 'debug', 'trace'],
    
    /**
     * 初始化控制台控制
     */
    init: function() {
      if (this.isDisabled) {
        this.disableConsole();
      }
    },
    
    /**
   * 禁用所有console输出
   */
  disableConsole: function() {
    if (typeof console === 'undefined') {
      return;
    }
    
    // 备份原始方法
    this.methodsToDisable.forEach(method => {
      if (typeof console[method] === 'function') {
        this.originalMethods[method] = console[method];
        // 用空函数替换原始方法
        console[method] = function() {};
      }
    });
    
    // 添加标识，表示console已被禁用
    console._isDisabled = true;
    
    // 添加一条特殊的测试日志，应该会被禁用
    console.log('【控制台控制】所有console输出已被禁用');
  },
    
    /**
     * 恢复所有console输出
     */
    enableConsole: function() {
      if (typeof console === 'undefined') {
        return;
      }
      
      // 恢复原始方法
      this.methodsToDisable.forEach(method => {
        if (this.originalMethods[method]) {
          console[method] = this.originalMethods[method];
        }
      });
      
      // 移除禁用标识
      delete console._isDisabled;
      this.isDisabled = false;
    },
    
    /**
     * 切换控制台输出状态
     */
    toggleConsole: function() {
      if (this.isDisabled) {
        this.enableConsole();
      } else {
        this.disableConsole();
      }
    },
    
    /**
     * 检查控制台是否被禁用
     */
    isConsoleDisabled: function() {
      return this.isDisabled;
    }
  };
  
  // 自动初始化（默认禁用console）
  ConsoleControl.init();
  
  // 添加页面加载完成后的延迟初始化，确保覆盖所有后续代码
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function() {
      setTimeout(function() {
        ConsoleControl.disableConsole();
        // 这条日志应该会被禁用，如果能看到说明控制失败
        console.log('【测试】如果看到这条日志说明控制台控制失败');
        console.error('【测试】错误日志也应该被禁用');
        console.warn('【测试】警告日志也应该被禁用');
      }, 100);
    });
  } else {
    setTimeout(function() {
      ConsoleControl.disableConsole();
      // 这条日志应该会被禁用，如果能看到说明控制失败
      console.log('【测试】如果看到这条日志说明控制台控制失败');
      console.error('【测试】错误日志也应该被禁用');
      console.warn('【测试】警告日志也应该被禁用');
    }, 100);
  }
  
  // 暴露全局接口
  window.ConsoleControl = ConsoleControl;
  
  // 如果需要调试，可以在浏览器控制台中执行以下命令：
  // ConsoleControl.enableConsole();   // 启用console输出
  // ConsoleControl.disableConsole();  // 禁用console输出
  // ConsoleControl.toggleConsole();   // 切换console输出状态
  
})();