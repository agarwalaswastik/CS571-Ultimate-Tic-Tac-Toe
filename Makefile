.PHONY: all clean

CXXFLAGS=-std=c++17 -Wall -O3
CFLAGS=-c $(CXXFLAGS)

all: run.out

run.out: bin/main.o bin/board.o
	g++ $(CXXFLAGS) $^ -o $@

bin/main.o: src/main.cpp
	@mkdir -p $(@D)
	g++ $(CFLAGS) $^ -o $@

bin/board.o: src/board.cpp
	@mkdir -p $(@D)
	g++ $(CFLAGS) $^ -o $@

clean:
	rm -rf bin/ *.out