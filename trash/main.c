#include <unistd.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

// char    lol(unsigned int x, char s)
// {
//     return (x + s);
// }

// char	*ft_strmapi(char const *s, char (*f)(unsigned int, char))
// {
// 	unsigned int	i;
// 	char			*str;

// 	i = 0;
// 	str = (char *)malloc(sizeof(char) * (strlen(s) + 1));
// 	if (!s || !f || !str)
// 		return (NULL);
// 	while (s[i] != '\0')
// 	{
// 		str[i] = f(i, s[i]);
// 		i++;
// 	}
// 	str[i] = '\0';
// 	return (str);
// }


void	ft_putchar_fd(char c, int fd)
{
	write(fd, &c, 1);
}

int main(int ac, char **av)
{
    // const char *ok = "abcdef";
    // printf("[av] %s [ap] %s", ok, ft_strmapi(ok, lol));

    ft_putchar_fd('e', -1);
}