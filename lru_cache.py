"""
LRU Cache 实现
使用 OrderedDict 保持键的访问顺序，实现 O(1) 的 get 和 put 操作
"""

from collections import OrderedDict


class LRUCache:
    """LRU 缓存类，容量固定，当缓存满时淘汰最久未使用的数据"""
    
    def __init__(self, capacity: int = 3):
        """
        初始化 LRU Cache
        
        Args:
            capacity: 缓存容量，默认为 3
        """
        self.capacity = capacity
        self.cache = OrderedDict()
    
    def get(self, key: int) -> int:
        """
        获取缓存中的值
        
        Args:
            key: 键
            
        Returns:
            如果键存在，返回值并将该键标记为最近使用
            如果键不存在，返回 -1
        """
        if key not in self.cache:
            return -1
        
        # 移动到末尾表示最近使用
        self.cache.move_to_end(key)
        return self.cache[key]
    
    def put(self, key: int, value: int) -> None:
        """
        向缓存中插入或更新值
        
        Args:
            key: 键
            value: 值
        """
        if key in self.cache:
            # 更新值并标记为最近使用
            self.cache.move_to_end(key)
        
        self.cache[key] = value
        
        # 如果超出容量，淘汰最久未使用的（OrderedDict 的第一个元素）
        if len(self.cache) > self.capacity:
            self.cache.popitem(last=False)
    
    def __repr__(self) -> str:
        """打印缓存当前状态"""
        items = list(self.cache.items())
        return f"LRUCache(capacity={self.capacity}, items={items})"
    
    def keys(self):
        """获取当前缓存中的所有键（按访问顺序）"""
        return list(self.cache.keys())


# ==================== 使用示例 ====================

if __name__ == "__main__":
    print("=" * 50)
    print("LRU Cache 使用示例")
    print("=" * 50)
    
    # 创建一个容量为 3 的 LRU Cache
    cache = LRUCache(3)
    
    print("\n1. 插入三个键值对: (1, 10), (2, 20), (3, 30)")
    cache.put(1, 10)
    cache.put(2, 20)
    cache.put(3, 30)
    print(f"   当前缓存: {cache}")
    
    print("\n2. 访问 key=1，将其标记为最近使用")
    result = cache.get(1)
    print(f"   get(1) = {result}")
    print(f"   当前缓存: {cache}")
    
    print("\n3. 插入新键值对 (4, 40)，缓存已满，淘汰最久未使用的 key=2")
    cache.put(4, 40)
    print(f"   put(4, 40)")
    print(f"   当前缓存: {cache}")
    
    print("\n4. 访问已被淘汰的 key=2")
    result = cache.get(2)
    print(f"   get(2) = {result} (不存在)")
    
    print("\n5. 更新 key=3 的值")
    cache.put(3, 300)
    print(f"   put(3, 300)")
    print(f"   当前缓存: {cache}")
    
    print("\n6. 插入新键值对 (5, 50)，淘汰最久未使用的 key=1")
    cache.put(5, 50)
    print(f"   put(5, 50)")
    print(f"   当前缓存: {cache}")
    
    print("\n7. 最终状态检查")
    print(f"   get(3) = {cache.get(3)}")
    print(f"   get(4) = {cache.get(4)}")
    print(f"   get(5) = {cache.get(5)}")
    print(f"   当前缓存: {cache}")
    
    print("\n" + "=" * 50)
    print("测试完成！")
    print("=" * 50)
