    // 关闭所有下拉菜单的函数
    function closeAllDropdowns() {
      document.querySelectorAll('.custom-dropdown-options').forEach(dropdown => {
        dropdown.style.display = 'none';
      });
    }
    
    // 全局点击事件监听，点击页面其他地方关闭所有下拉菜单
    document.addEventListener('click', function(event) {
      // 如果点击的不是下拉菜单按钮或下拉菜单内容，则关闭所有下拉菜单
      const clickedDropdownButton = event.target.closest('[id$="Button"]');
      const clickedDropdownContent = event.target.closest('.custom-dropdown-options');
      
      if (!clickedDropdownButton && !clickedDropdownContent) {
        closeAllDropdowns();
      }
    });
